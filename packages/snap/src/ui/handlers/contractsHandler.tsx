import type { TxParams, TxStepLog, TxTelemetry } from '../../types';
import { DEFAULT_BLOB_RELAYER_URL } from '../../constants';
import { encodePingDelegation, parseEthToWeiHex } from '../../crypto';
import { calculateIntrinsicGas, internalSignAndSerializeTx } from '../../transactions';
import { sanitizeRpcUrl, fetchContractCall, fetchCode, pollTransactionReceipt } from '../../rpc';
import {
  getState,
  updateState,
  appendTxTelemetryToHistory,
  fetchRpcPreflight,
  fetchAccessListStep,
  signBroadcastAndRecordTx,
  getActiveAccount,
  renderTxDetails,
  showAlert,
  showConfirm,
} from '../helpers';

let isContractsBusy = false;

export async function handleContractsEvents(eventName: string, eventValue?: any): Promise<boolean> {
  const state = await getState();
  const activeAccount = getActiveAccount(state);
  const getTargetRpcUrl = () => sanitizeRpcUrl(state.dsaRpcUrl || 'http://localhost:8545');
  const targetContract = state.generalContractAddress || '';

  if (eventName === 'input_contracts_sender') {
    const chosen = String(eventValue || '').trim();
    if (chosen.startsWith('0x')) {
      await updateState({ selectedAccountAddress: chosen });
    }
    return true;
  }

  if (eventName === 'form_configure_general_contract') {
    const target = eventValue?.input_general_contract ? String(eventValue.input_general_contract).trim() : '';
    if (target) await updateState({ generalContractAddress: target });
    return true;
  }

  if (eventName === 'btn_check_contract_counter') {
    if (!targetContract) {
      await showAlert('Contrato não definido', 'Informe e salve o endereço do contrato alvo antes de consultar.');
      return true;
    }
    const targetRpcUrl = getTargetRpcUrl();
    const rawHex = await fetchContractCall(targetRpcUrl, targetContract, '0x61bc221a'); // counter()
    const val = BigInt(!rawHex || rawHex === '0x' ? '0x0' : rawHex);
    await updateState({ contractCounterDisplay: `${val.toString()} chamadas registradas no contrato ${targetContract.slice(0, 10)}...` });
    return true;
  }

  if (eventName === 'form_send_general_0x41') {
    if (isContractsBusy || !activeAccount) return true;
    if (!targetContract) {
      await showAlert('Contrato não definido', 'Informe e salve o endereço do contrato alvo antes de enviar.');
      return true;
    }
    isContractsBusy = true;

    try {
      const targetRpcUrl = getTargetRpcUrl();
      const cycleStart = Date.now();
      const calldata = String(eventValue?.input_calldata_0x41 || '0xd09de08a').trim();

      const preflight = await fetchRpcPreflight(targetRpcUrl, activeAccount.address);
      const { nonce, gasPrice, chainId } = preflight;
      const al = await fetchAccessListStep(
        targetRpcUrl,
        { from: activeAccount.address, to: targetContract, value: '0x0', data: calldata },
        2,
      );
      const accessList = al.accessList;
      const pipelineSteps: TxStepLog[] = [preflight.step, al.step];

      const minIntrinsicGas = calculateIntrinsicGas(
        { from: activeAccount.address, to: targetContract, data: calldata, type: '0x41', accessList },
        activeAccount.options,
      );
      const gasLimit = '0x' + Math.max(3000000, minIntrinsicGas).toString(16);

      const tx: TxParams = {
        from: activeAccount.address,
        to: targetContract,
        value: '0x0',
        nonce,
        gasLimit,
        chainId,
        data: calldata,
        type: '0x41',
        gasPrice,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        accessList,
      };

      const confirmed = await showConfirm(
        'Confirmar Transação Contrato (0x41)',
        renderTxDetails(tx, 'Snap UI (Contratos)', activeAccount),
      );
      if (!confirmed) return true;

      const { effectiveHash, statusLine } = await signBroadcastAndRecordTx({
        rpcUrl: targetRpcUrl,
        tx,
        account: activeAccount,
        pipelineSteps,
        cycleStartMs: cycleStart,
        buildStatusLine: ({ receipt, blockNumberDec, gasUsedDec, receiptStatus }) =>
          receipt
            ? receiptStatus === 'reverted'
              ? `⚠️ Transação 0x41 minerada no bloco #${String(blockNumberDec)}, porém revertida (0x0).`
              : `✅ Transação 0x41 confirmada no bloco #${String(blockNumberDec)} (Gas usado: ${gasUsedDec?.toLocaleString('pt-BR') ?? '-'})!`
            : '✅ Transação 0x41 enviada com sucesso ao Besu!',
        buildExtraState: ({ effectiveHash: hash, statusLine: msg, telemetry }) => ({
          generalCalldata: calldata,
          lastGeneralTxHash: hash,
          lastGeneralTxStatus: msg,
          lastGeneralAccessList: accessList.length > 0 ? JSON.stringify(accessList) : '[]',
          ...(telemetry ? { lastGeneralTxTelemetry: telemetry } : {}),
        }),
      });

      await showAlert('Transação 0x41 Enviada!', statusLine, effectiveHash);
    } catch (e: any) {
      console.error('Erro na transação 0x41:', e);
      await showAlert('Erro no Envio', String(e?.message || e));
    } finally {
      isContractsBusy = false;
    }
    return true;
  }

  if (eventName === 'form_send_general_0x44' || eventName === 'btn_revoke_delegation') {
    if (isContractsBusy || !activeAccount) return true;
    const isRevoke = eventName === 'btn_revoke_delegation';
    if (!isRevoke && !targetContract) {
      await showAlert('Contrato não definido', 'Informe e salve o endereço do contrato alvo antes de delegar.');
      return true;
    }
    isContractsBusy = true;

    try {
      const targetRpcUrl = getTargetRpcUrl();
      const cycleStart = Date.now();
      const destinationContract = isRevoke ? '0x0000000000000000000000000000000000000000' : targetContract;
      const note = String(eventValue?.input_ping_note || 'Executado via MetaMask PQC Snap').trim();
      const calldata = isRevoke ? '0x' : encodePingDelegation(note);

      const preflight = await fetchRpcPreflight(targetRpcUrl, activeAccount.address);
      const { nonce, gasPrice, chainId } = preflight;

      const txNonceNum = parseInt(nonce || '0x0', 16);
      const authNonceHex = '0x' + (txNonceNum + 1).toString(16);
      const authorizationList = [{ chainId, address: destinationContract, nonce: authNonceHex }];

      const pipelineSteps: TxStepLog[] = [
        preflight.step,
        {
          step: 2,
          label: isRevoke ? 'Preparação Revogação EIP-7702' : 'Preparação Delegação EIP-7702 (0x44)',
          detail: `Contrato alvo: ${destinationContract} (authNonce: ${authNonceHex})`,
          status: 'ok',
        },
      ];

      const minIntrinsicGas = calculateIntrinsicGas(
        {
          from: activeAccount.address,
          to: activeAccount.address,
          data: calldata,
          type: '0x44',
          authorizationList,
        },
        activeAccount.options,
      );
      const gasLimit = '0x' + Math.max(1000000, minIntrinsicGas).toString(16);

      const tx: TxParams = {
        from: activeAccount.address,
        to: activeAccount.address,
        value: '0x0',
        nonce: '0x' + txNonceNum.toString(16),
        gasLimit,
        chainId,
        data: calldata,
        type: '0x44',
        gasPrice,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        accessList: [],
        authorizationList,
      };

      const confirmed = await showConfirm(
        isRevoke ? 'Revogar Delegação (Voltar para EOA 0x)' : 'Confirmar Delegação Code Flex (0x44)',
        renderTxDetails(tx, isRevoke ? 'Revogação EIP-7702' : `Delegação EIP-7702 (${note})`, activeAccount),
      );
      if (!confirmed) return true;

      let updatedCode = '0x';
      const { effectiveHash } = await signBroadcastAndRecordTx({
        rpcUrl: targetRpcUrl,
        tx,
        account: activeAccount,
        pipelineSteps,
        cycleStartMs: cycleStart,
        afterBroadcast: async (hash) => {
          const receiptStart = Date.now();
          const receipt = await pollTransactionReceipt(targetRpcUrl, hash, 6, 1000);
          const receiptDurationMs = Math.max(1, Date.now() - receiptStart);
          try {
            updatedCode = await fetchCode(targetRpcUrl, activeAccount.address);
          } catch (codeErr) {
            console.warn('Aviso no bytecode:', codeErr);
          }
          const blockNum = receipt?.blockNumber ? parseInt(String(receipt.blockNumber), 16) : undefined;
          const gasUsed = receipt?.gasUsed ? parseInt(String(receipt.gasUsed), 16) : undefined;
          return {
            receipt,
            receiptDurationMs,
            receiptDetailOverride: receipt
              ? `Bloco #${String(blockNum)} | Gas Usado: ${gasUsed?.toLocaleString('pt-BR') ?? '-'} | Código EOA: ${updatedCode.slice(0, 16)}`
              : `Recibo pendente | Código EOA atual: ${updatedCode.slice(0, 16)}`,
          };
        },
        buildStatusLine: () =>
          isRevoke
            ? updatedCode === '0x'
              ? '✅ Delegação revogada com sucesso!'
              : '✅ Transação de revogação transmitida!'
            : updatedCode.startsWith('0xef0100')
            ? `✅ Delegação EIP-7702 confirmada (${updatedCode.slice(0, 14)}...)!`
            : '✅ Transação 0x44 transmitida!',
        buildExtraState: ({ effectiveHash: hash, statusLine: msg, telemetry }) => ({
          lastGeneralTxHash: hash,
          delegatedBytecodeDisplay: updatedCode,
          lastGeneralTxStatus: msg,
          ...(telemetry ? { lastGeneralTxTelemetry: telemetry } : {}),
        }),
      });

      await showAlert(
        isRevoke ? 'Delegação Revogada!' : 'Delegação 0x44 Concluída!',
        isRevoke ? 'A autorização foi resetada para zero (EOA pura).' : 'Transação de delegação executada com sucesso.',
        effectiveHash,
      );
    } catch (e: any) {
      console.error('Erro na delegação 0x44:', e);
      await showAlert('Erro na Delegação', String(e?.message || e));
    } finally {
      isContractsBusy = false;
    }
    return true;
  }

  if (eventName === 'btn_check_general_delegation_code') {
    if (!activeAccount) return true;
    const targetRpcUrl = getTargetRpcUrl();
    const code = await fetchCode(targetRpcUrl, activeAccount.address);
    await updateState({ delegatedBytecodeDisplay: code });
    return true;
  }

  if (eventName === 'form_send_blob') {
    if (isContractsBusy || !activeAccount) return true;
    isContractsBusy = true;

    try {
      const targetRpcUrl = getTargetRpcUrl();
      const cycleStart = Date.now();
      const rawRelayerUrl = String(eventValue?.input_blob_relayer_url || '').trim();
      const relayerUrl = sanitizeRpcUrl(rawRelayerUrl || state.blobRelayerUrl || DEFAULT_BLOB_RELAYER_URL);
      const recipient = String(eventValue?.input_blob_recipient || '').trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
        throw new Error('Endereço de destino inválido para envio via Blob.');
      }
      const amount = String(eventValue?.input_blob_amount || '0.01').trim();
      const valueHex = parseEthToWeiHex(amount);

      const preflight = await fetchRpcPreflight(targetRpcUrl, activeAccount.address);
      const { nonce, gasPrice, chainId } = preflight;
      const txType = activeAccount.options?.isEcdsa ? '0x02' : '0x42';

      const minIntrinsicGas = calculateIntrinsicGas(
        { from: activeAccount.address, to: recipient, value: valueHex, data: '0x', type: txType },
        activeAccount.options,
      );
      const gasLimit = '0x' + Math.max(1000000, minIntrinsicGas).toString(16);

      const tx: TxParams = {
        from: activeAccount.address,
        to: recipient,
        value: valueHex,
        nonce,
        gasLimit,
        chainId,
        data: '0x',
        type: txType,
        gasPrice,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        accessList: [],
      };

      const confirmed = await showConfirm(
        'Confirmar Transação Blob (EIP-4844)',
        renderTxDetails(tx, 'Snap UI (Blob EIP-4844)', activeAccount),
      );
      if (!confirmed) return true;

      const { signatureHex, txHash, telemetry } = await internalSignAndSerializeTx(tx, activeAccount);

      const relayerStart = Date.now();
      const relayerRes = await fetch(relayerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signatureHex,
          toAddress: recipient,
          amount,
        }),
      });
      const relayerJson = (await relayerRes.json()) as any;
      const relayerDurationMs = Math.max(1, Date.now() - relayerStart);

      if (!relayerRes.ok || !relayerJson?.success) {
        throw new Error(relayerJson?.error || `Erro HTTP ${relayerRes.status} no Relayer EIP-4844.`);
      }

      const effectiveHash = String(relayerJson.hash || txHash);
      const blobVersionedHash = String(relayerJson.blobVersionedHash || '');
      const statusLine = `✅ Blob EIP-4844 enviado! ${relayerJson.algorithm || ''} (${relayerJson.signatureBytes ?? '-'} B) | Blob: ${blobVersionedHash || '-'}`;

      const signSteps = (telemetry?.steps || []).map((s, idx) => ({
        ...s,
        step: idx + 2,
      }));
      const relayerStep: TxStepLog = {
        step: signSteps.length + 2,
        label: `Relayer EIP-4844 (${relayerUrl})`,
        detail: `Tx: ${effectiveHash}${blobVersionedHash ? ` | Blob: ${blobVersionedHash}` : ''}`,
        durationMs: relayerDurationMs,
        status: 'ok',
      };

      const fullTelemetry: TxTelemetry | undefined = telemetry
        ? {
            ...telemetry,
            id: effectiveHash || telemetry.id,
            txHash: effectiveHash,
            receiptStatus: 'success',
            totalDurationMs: Math.max(1, Date.now() - cycleStart),
            steps: [preflight.step, ...signSteps, relayerStep],
          }
        : undefined;

      const extraState = {
        blobRelayerUrl: relayerUrl,
        blobRecipient: recipient,
        blobAmountEth: amount,
        lastBlobVersionedHash: blobVersionedHash,
        lastGeneralTxHash: effectiveHash,
        lastGeneralTxStatus: statusLine,
        ...(fullTelemetry ? { lastGeneralTxTelemetry: fullTelemetry } : {}),
      };

      if (fullTelemetry) {
        await appendTxTelemetryToHistory(fullTelemetry, extraState);
      } else {
        await updateState(extraState);
      }

      await showAlert('Blob EIP-4844 Enviado!', statusLine, effectiveHash);
    } catch (e: any) {
      console.error('Erro na transação Blob:', e);
      await updateState({ lastGeneralTxStatus: `❌ Erro no envio Blob: ${String(e?.message || e)}` });
      await showAlert('Erro no Envio Blob', String(e?.message || e));
    } finally {
      isContractsBusy = false;
    }
    return true;
  }

  return false;
}
