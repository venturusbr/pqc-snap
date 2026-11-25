import { sanitizeRpcUrl, fetchSupportedDSAs } from '../../rpc';
import { getState, updateState, showAlert } from '../helpers';

export async function handleRpcEvents(eventName: string, eventValue?: any): Promise<boolean> {
  if (eventName === 'form_configure_global_rpc') {
    try {
      const raw = eventValue?.input_global_rpc;
      const trimmed = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
      if (!trimmed) {
        await showAlert('IP / RPC Inválido', 'Informe um endereço IP ou URL válido para o nó Besu.');
        return true;
      }

      const newRpcUrl = sanitizeRpcUrl(trimmed);
      await updateState({
        dsaRpcUrl: newRpcUrl,
        lastGeneralTxStatus: `ℹ️ Endpoint RPC atualizado para ${newRpcUrl}`,
      });
      await showAlert('IP / RPC do Besu Atualizado', 'O endereço do nó Besu foi salvo com sucesso:', newRpcUrl);
    } catch (err: any) {
      console.error('Erro ao atualizar IP do Besu:', err);
      await showAlert('Erro ao Atualizar IP / RPC', String(err?.message || err));
    }
    return true;
  }

  if (eventName === 'btn_fetch_dsa') {
    try {
      const state = await getState();
      const targetUrl = state.dsaRpcUrl || 'http://localhost:8545';

      try {
        const dsas = await fetchSupportedDSAs(targetUrl);
        await updateState({ dsaError: undefined, supportedDSAs: dsas });
      } catch (errText: any) {
        await updateState({ dsaError: String(errText?.message || errText), supportedDSAs: [] });
      }
    } catch (err: any) {
      console.error('Erro ao consultar DSAs:', err);
    }
    return true;
  }

  return false;
}
