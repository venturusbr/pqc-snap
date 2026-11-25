import type { TxParams, TxStepLog } from '../../types';
import { parseEthToWeiHex } from '../../crypto';
import { calculateIntrinsicGas } from '../../transactions';
import { sanitizeRpcUrl } from '../../rpc';
import {
  getState,
  updateState,
  fetchRpcPreflight,
  fetchAccessListStep,
  signBroadcastAndRecordTx,
  getActiveAccount,
  renderTxDetails,
  showAlert,
  showConfirm,
} from '../helpers';

let isTxBusy = false;

export async function handleTxEvents(id: string, event: { name: string; type?: string; value?: any }): Promise<boolean> {
  if (event.name === 'input_sender') {
    const chosen = String(event.value || '').trim();
    if (chosen.startsWith('0x')) {
      const state = await getState();
      const acc = (state.accounts || []).find((a) => a.address.toLowerCase() === chosen.toLowerCase());
      const currentType = (state.selectedTxType || '0x42').toLowerCase();
      const needsClassicFallback = Boolean(acc?.options?.isEcdsa) && ['0x41', '0x42', '0x44', '0x04'].includes(currentType);
      await updateState({
        selectedAccountAddress: chosen,
        ...(needsClassicFallback ? { selectedTxType: '0x02' } : {}),
      });
    }
    return true;
  }

  if (event.name === 'input_tx_type') {
    const chosen = String(event.value || '').trim().toLowerCase();
    if (chosen) {
      await updateState({ selectedTxType: chosen });
    }
    return true;
  }

  if (event.name === 'input_recipient_preset') {
    const chosen = String(event.value || '').trim();
    await updateState({ txRecipientPreset: chosen === 'manual' ? '' : chosen });
    return true;
  }

  if (event.name === 'input_calldata_preset') {
    const chosen = String(event.value || '0x').trim();
    await updateState({ txCalldataPreset: chosen });
    return true;
  }

  if (event.name === 'select_log_entry') {
    const chosen = String(event.value || '').trim();
    if (chosen) {
      await updateState({ selectedLogId: chosen });
    }
    return true;
  }

  if (event.name === 'btn_clear_tx_logs') {
    await updateState({
      txHistory: [],
      lastTxTelemetry: undefined,
      lastGeneralTxTelemetry: undefined,
      selectedLogId: undefined,
    });
    return true;
  }

  if (event.name === 'form_send_tx_0x42') {
    if (isTxBusy) return true;
    isTxBusy = true;

    try {
      const cycleStart = Date.now();
      const state = await getState();
      const accounts = state.accounts || [];
      if (accounts.length === 0) {
        await showAlert('Nenhuma Conta', 'Derive uma conta antes de enviar transações.');
        return true;
      }

      let rawSender = state.selectedAccountAddress;
      let rawRecipient = state.txRecipientPreset || '';
      let rawAmount = '';
      let rawRpcUrl = '';
      let rawData = state.txCalldataPreset && state.txCalldataPreset !== '0x' ? state.txCalldataPreset : '';
      let rawTxType = state.selectedTxType || '0x42';

      if (event.value && typeof event.value === 'object') {
        const fv = event.value as Record<string, any>;
        if (fv.input_sender) rawSender = String(fv.input_sender).trim();
        const inputRpc = fv.input_tx_rpc_url || fv.input_rpc_url;
        if (inputRpc) rawRpcUrl = String(inputRpc).trim();
        if (fv.input_recipient !== undefined && String(fv.input_recipient).trim().length > 0) {
          rawRecipient = String(fv.input_recipient).trim();
        }
        if (fv.input_amount) rawAmount = String(fv.input_amount).trim().replace(',', '.');
        if (fv.input_data !== undefined && String(fv.input_data).trim().length > 0) {
          rawData = String(fv.input_data).trim();
        }
        if (fv.input_tx_type) {
          rawTxType = String(fv.input_tx_type).trim().toLowerCase();
        }
      }

      const activeAccount =
        accounts.find((a) => a.address.toLowerCase() === (rawSender || '').toLowerCase()) ||
        getActiveAccount(state) ||
        accounts[0];

      if (!activeAccount) {
        await showAlert('Nenhuma Conta', 'Conta remetente inválida.');
        return true;
      }

      if (activeAccount.options?.isEcdsa && ['0x41', '0x42', '0x44', '0x04'].includes(rawTxType)) {
        rawTxType = '0x02';
      }

      const targetRpcUrl = sanitizeRpcUrl(rawRpcUrl || state.dsaRpcUrl || 'http://localhost:8545');
      const targetRecipient = rawRecipient.length > 0 ? rawRecipient : activeAccount.address;
      const targetAmountEth = rawAmount.length > 0 ? rawAmount : '0';
      const valueHex = parseEthToWeiHex(targetAmountEth);

      let targetData = '0x';
      if (rawData.length > 0) {
        let clean = rawData.replace(/\s+/g, '').replace(/^0x/i, '');
        if (clean.length > 0) {
          if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error('Data contém caracteres hexadecimais inválidos.');
          if (clean.length % 2 !== 0) clean = '0' + clean;
          targetData = '0x' + clean.toLowerCase();
        }
      }

      const preflight = await fetchRpcPreflight(targetRpcUrl, activeAccount.address);
      const { nonce, gasPrice, chainId } = preflight;
      const pipelineSteps: TxStepLog[] = [preflight.step];

      let accessList: any[] = [];
      if (rawTxType === '0x41' || rawTxType === '0x01') {
        const al = await fetchAccessListStep(
          targetRpcUrl,
          { from: activeAccount.address, to: targetRecipient, value: valueHex, data: targetData },
          2,
        );
        accessList = al.accessList;
        pipelineSteps.push(al.step);
      }

      const authorizationList =
        rawTxType === '0x44'
          ? [{ chainId, address: targetRecipient, nonce: '0x' + (parseInt(nonce || '0x0', 16) + 1).toString(16) }]
          : undefined;
      if (authorizationList) {
        pipelineSteps.push({
          step: pipelineSteps.length + 1,
          label: 'Preparação EIP-7702 (0x44)',
          detail: `Delegação alvo: ${targetRecipient} (authNonce: ${authorizationList[0].nonce})`,
          status: 'ok',
        });
      }

      const hasData = targetData !== '0x' && targetData.length > 2;
      const minIntrinsicGas = calculateIntrinsicGas(
        {
          from: activeAccount.address,
          to: targetRecipient,
          data: targetData,
          type: rawTxType,
          accessList,
          authorizationList,
        },
        activeAccount.options,
      );
      const defaultGasLimit = hasData ? 3000000 : 1000000;
      const gasLimit = '0x' + Math.max(defaultGasLimit, minIntrinsicGas).toString(16);

      const tx: TxParams = {
        from: activeAccount.address,
        to: rawTxType === '0x44' ? activeAccount.address : targetRecipient,
        value: valueHex,
        nonce,
        gasLimit,
        chainId,
        data: targetData,
        type: rawTxType,
        gasPrice,
        maxPriorityFeePerGas: gasPrice,
        maxFeePerGas: gasPrice,
        accessList,
        ...(authorizationList ? { authorizationList } : {}),
      };

      const confirmed = await showConfirm(
        `Confirmar Transação (${rawTxType})`,
        renderTxDetails(tx, 'Snap UI', activeAccount),
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
              ? `⚠️ Transação ${rawTxType} minerada no bloco #${String(blockNumberDec)}, porém revertida (0x0).`
              : `✅ Transação ${rawTxType} confirmada no bloco #${String(blockNumberDec)} (Gas usado: ${gasUsedDec?.toLocaleString('pt-BR') ?? '-'})!`
            : `✅ Transação ${rawTxType} transmitida ao nó Besu (recibo pendente).`,
        buildExtraState: ({ effectiveHash: hash, statusLine: msg }) => ({
          selectedAccountAddress: activeAccount.address,
          selectedTxType: rawTxType,
          lastTxHash: hash,
          lastTxStatus: msg,
          lastTxAccessList: accessList.length > 0 ? JSON.stringify(accessList) : '[]',
        }),
      });

      await showAlert('Transação Enviada!', statusLine, effectiveHash);
    } catch (err: any) {
      console.error('Erro no envio da transação:', err);
      await updateState({ lastTxStatus: `❌ Falha: ${err?.message || err}` });
      await showAlert('Falha no Envio', String(err?.message || err));
    } finally {
      isTxBusy = false;
    }
    return true;
  }

  return false;
}
