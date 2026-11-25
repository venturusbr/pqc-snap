import type { KeyringAccount } from '@metamask/keyring-api';
import type { SnapState, TxParams, TxStepLog, TxTelemetry } from '../../types';
import { formatWeiHexToGwei } from '../../crypto';
import { internalSignAndSerializeTx } from '../../transactions';
import {
  createAccessList,
  fetchChainId,
  fetchGasPrice,
  fetchNonce,
  pollTransactionReceipt,
  sendRawTransaction,
} from '../../rpc';
import { appendTxTelemetryToHistory, updateState } from './stateHelper';

/**
 * Busca a Access List via RPC e devolve a lista + o registro do passo para telemetria.
 */
export async function fetchAccessListStep(
  rpcUrl: string,
  txParams: { from: string; to: string; value: string; data: string },
  stepNumber = 2,
): Promise<{ accessList: any[]; step: TxStepLog }> {
  let accessList: any[] = [];
  const alStart = Date.now();
  try {
    const alResult = await createAccessList(rpcUrl, txParams);
    if (alResult?.accessList) accessList = alResult.accessList;
    const slotCount = accessList.reduce(
      (acc, item) => acc + (Array.isArray(item?.storageKeys) ? item.storageKeys.length : 0),
      0,
    );
    return {
      accessList,
      step: {
        step: stepNumber,
        label: 'eth_createAccessList',
        detail: `${String(accessList.length)} endereço(s) e ${String(slotCount)} slot(s) aquecidos`,
        durationMs: Math.max(1, Date.now() - alStart),
        status: 'ok',
      },
    };
  } catch (alErr: any) {
    console.warn('Falha no accessList:', alErr);
    return {
      accessList: [],
      step: {
        step: stepNumber,
        label: 'eth_createAccessList',
        detail: `Fallback vazio (${String(alErr?.message || alErr)})`,
        durationMs: Math.max(1, Date.now() - alStart),
        status: 'warn',
      },
    };
  }
}

export interface RpcPreflightResult {
  nonce: string;
  gasPrice: string;
  chainId: string;
  step: TxStepLog;
}

/**
 * Busca nonce, gasPrice e chainId em paralelo e registra o passo inicial da trilha de execução.
 */
export async function fetchRpcPreflight(
  rpcUrl: string,
  address: string,
): Promise<RpcPreflightResult> {
  const rpcStart = Date.now();
  const [nonce, gasPrice, chainId] = await Promise.all([
    fetchNonce(rpcUrl, address),
    fetchGasPrice(rpcUrl),
    fetchChainId(rpcUrl),
  ]);

  const step: TxStepLog = {
    step: 1,
    label: `Pré-voo RPC (${rpcUrl})`,
    detail: `Nonce: ${String(parseInt(nonce, 16))} (${nonce}) | ChainId: ${String(parseInt(chainId, 16))} | GasPrice: ${formatWeiHexToGwei(gasPrice)}`,
    durationMs: Math.max(1, Date.now() - rpcStart),
    status: 'ok',
  };

  return { nonce, gasPrice, chainId, step };
}

export interface ExecuteAndRecordTxOptions {
  rpcUrl: string;
  tx: TxParams;
  account: KeyringAccount;
  pipelineSteps: TxStepLog[];
  cycleStartMs: number;
  afterBroadcast?: (txHash: string) => Promise<{
    receipt: any | null;
    receiptDurationMs: number;
    receiptDetailOverride?: string;
  }>;
  buildStatusLine: (params: {
    effectiveHash: string;
    receipt: any | null;
    blockNumberDec?: number;
    gasUsedDec?: number;
    receiptStatus: TxTelemetry['receiptStatus'];
  }) => string;
  buildExtraState: (params: {
    effectiveHash: string;
    statusLine: string;
    telemetry?: TxTelemetry;
  }) => Partial<SnapState>;
}

/**
 * Assina, transmite via RPC, aguarda o recibo e persiste a telemetria completa no histórico do Snap.
 */
export async function signBroadcastAndRecordTx(
  opts: ExecuteAndRecordTxOptions,
): Promise<{
  effectiveHash: string;
  statusLine: string;
  receipt: any | null;
  telemetry?: TxTelemetry;
}> {
  const { serializedTx, txHash, telemetry } = await internalSignAndSerializeTx(opts.tx, opts.account);

  const broadcastStart = Date.now();
  const finalHash = await sendRawTransaction(opts.rpcUrl, serializedTx);
  const effectiveHash = finalHash || txHash;
  const broadcastDurationMs = Math.max(1, Date.now() - broadcastStart);

  let receipt: any | null = null;
  let receiptDurationMs = 0;
  let receiptDetailOverride: string | undefined;

  if (opts.afterBroadcast) {
    const res = await opts.afterBroadcast(effectiveHash);
    receipt = res.receipt;
    receiptDurationMs = res.receiptDurationMs;
    receiptDetailOverride = res.receiptDetailOverride;
  } else {
    const receiptStart = Date.now();
    receipt = await pollTransactionReceipt(opts.rpcUrl, effectiveHash, 6, 1000);
    receiptDurationMs = Math.max(1, Date.now() - receiptStart);
  }

  const blockNumberDec = receipt?.blockNumber ? parseInt(String(receipt.blockNumber), 16) : undefined;
  const gasUsedDec = receipt?.gasUsed ? parseInt(String(receipt.gasUsed), 16) : undefined;
  const receiptStatus: TxTelemetry['receiptStatus'] = receipt
    ? receipt.status === '0x0'
      ? 'reverted'
      : 'success'
    : 'error';

  const baseOffset = opts.pipelineSteps.length;
  const signSteps = (telemetry?.steps || []).map((s, idx) => ({
    ...s,
    step: baseOffset + idx + 1,
  }));
  const broadcastStep: TxStepLog = {
    step: baseOffset + signSteps.length + 1,
    label: 'Broadcast RPC (eth_sendRawTransaction)',
    detail: `Hash aceito pelo nó: ${effectiveHash}`,
    durationMs: broadcastDurationMs,
    status: 'ok',
  };
  const receiptStep: TxStepLog = {
    step: broadcastStep.step + 1,
    label: 'Confirmação do Bloco (eth_getTransactionReceipt)',
    detail:
      receiptDetailOverride ||
      (receipt
        ? `Bloco #${String(blockNumberDec)} | Status: ${receipt.status || '0x1'} | Gas Usado: ${gasUsedDec?.toLocaleString('pt-BR') ?? '-'}`
        : 'Recibo ainda não minerado dentro da janela de 6s'),
    durationMs: receiptDurationMs,
    status: receipt ? (receiptStatus === 'reverted' ? 'error' : 'ok') : 'warn',
  };

  const fullTelemetry: TxTelemetry | undefined = telemetry
    ? {
        ...telemetry,
        id: effectiveHash || telemetry.id,
        txHash: effectiveHash,
        blockNumberDec,
        gasUsedDec,
        receiptStatus,
        totalDurationMs: Math.max(1, Date.now() - opts.cycleStartMs),
        steps: [...opts.pipelineSteps, ...signSteps, broadcastStep, receiptStep],
      }
    : undefined;

  const statusLine = opts.buildStatusLine({
    effectiveHash,
    receipt,
    blockNumberDec,
    gasUsedDec,
    receiptStatus,
  });

  const extraState = opts.buildExtraState({
    effectiveHash,
    statusLine,
    telemetry: fullTelemetry,
  });

  if (fullTelemetry) {
    await appendTxTelemetryToHistory(fullTelemetry, extraState);
  } else {
    await updateState(extraState);
  }

  return { effectiveHash, statusLine, receipt, telemetry: fullTelemetry };
}
