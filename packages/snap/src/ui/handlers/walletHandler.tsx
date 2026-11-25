import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import { generateMnemonic, validateMnemonic } from '../../crypto';
import { pqcKeyring } from '../../keyring';
import { sanitizeRpcUrl, fetchEthBalance } from '../../rpc';
import { getState, updateState, getActiveAccount, showAlert, showConfirm, showPrompt, confirmWalletOverwrite } from '../helpers';

export async function handleWalletEvents(eventName: string): Promise<boolean> {
  if (
    eventName === 'btn_create_ecdsa' ||
    eventName === 'btn_create_hybrid' ||
    eventName === 'btn_create_hybrid_falcon' ||
    eventName === 'btn_create_pure_mldsa' ||
    eventName === 'btn_create_pure_falcon'
  ) {
    try {
      let choice = '3';
      let typeLabel = 'Híbrida (ECDSA + ML-DSA-44)';

      if (eventName === 'btn_create_ecdsa') {
        choice = '1';
        typeLabel = 'ECDSA Clássica Padrão (BIP-44 secp256k1)';
      } else if (eventName === 'btn_create_hybrid_falcon') {
        choice = '4';
        typeLabel = 'Híbrida (ECDSA + Falcon-512)';
      } else if (eventName === 'btn_create_pure_mldsa') {
        choice = '2';
        typeLabel = 'ML-DSA-44 Pura (PQC Standalone)';
      } else if (eventName === 'btn_create_pure_falcon') {
        choice = '5';
        typeLabel = 'Falcon-512 Pura (PQC Standalone)';
      }

      const newAcc = await pqcKeyring.createAccount({ choice });
      await showAlert(
        'Conta Derivada com Sucesso!',
        `Nova conta ${typeLabel} registrada:`,
        newAcc.address,
      );
    } catch (error: any) {
      console.error('Erro ao derivar conta:', error);
      await showAlert('Erro na Derivação', String(error?.message || error));
    }
    return true;
  }

  if (eventName === 'btn_init_generate') {
    try {
      const state = await getState();
      if (!(await confirmWalletOverwrite(state))) return true;

      const newMnemonic = generateMnemonic();
      await showAlert(
        'Nova Frase Mnemônica (24 palavras)',
        'Guarde estas 24 palavras em local seguro. Se perder esta frase, perderá o acesso às suas contas:',
        newMnemonic,
      );

      await updateState({ accounts: [], mnemonic: newMnemonic });
    } catch (error: any) {
      console.error('Erro ao gerar semente:', error);
    }
    return true;
  }

  if (eventName === 'btn_init_import') {
    try {
      if (!(await confirmWalletOverwrite(await getState()))) return true;
      const mnemonicInput = await showPrompt(
        'Importar Frase de Recuperação',
        'Digite as 24 palavras separadas por espaço:',
        'palavra1 palavra2 ... palavra24',
      );

      if (mnemonicInput && typeof mnemonicInput === 'string') {
        const cleaned = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ');
        if (validateMnemonic(cleaned)) {
          await updateState({ accounts: [], mnemonic: cleaned });
          await showAlert('Carteira Importada', 'Sua frase mnemônica de 24 palavras foi validada e salva com sucesso!');
        } else {
          await showAlert('Erro de Validação', 'A frase inserida não possui 24 palavras válidas no padrão BIP-39.');
        }
      }
    } catch (error: any) {
      console.error('Erro ao importar mnemônico:', error);
    }
    return true;
  }

  if (eventName === 'btn_view_mnemonic') {
    try {
      const state = await getState();
      if (!state.mnemonic) {
        await showAlert('Aviso', 'Nenhuma frase de recuperação configurada nesta carteira.');
        return true;
      }

      const confirmed = await showConfirm(
        'Exibir Frase de Recuperação?',
        <Text><Bold>ATENÇÃO:</Bold> Nunca compartilhe sua frase com ninguém. Deseja visualizar agora?</Text>,
      );

      if (confirmed) {
        await showAlert('Sua Frase de Recuperação (24 palavras)', 'Guarde em local seguro e offline:', state.mnemonic);
      }
    } catch (err: any) {
      console.error('Erro ao visualizar mnemônico:', err);
    }
    return true;
  }

  if (eventName === 'btn_check_account_balances' || eventName === 'btn_refresh') {
    try {
      const state = await getState();
      const activeAccount = getActiveAccount(state);
      if (!activeAccount) return true;

      const targetRpcUrl = sanitizeRpcUrl(state.dsaRpcUrl || 'http://localhost:8545');

      const { eth, wei } = await fetchEthBalance(targetRpcUrl, activeAccount.address);
      const ethBalanceStr = `${eth} ETH (${wei.toString()} wei)`;

      await updateState({ ethBalanceDisplay: ethBalanceStr });
    } catch (err: any) {
      console.error('Erro ao atualizar saldos:', err);
    }
    return true;
  }

  return false;
}
