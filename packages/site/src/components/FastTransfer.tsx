import type { FormEvent } from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background: rgba(26, 32, 44, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #edf2f7;
`;

const HelperText = styled.p`
  font-size: 13px;
  color: #a0aec0;
  margin: 0 0 18px 0;
  line-height: 1.5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  color: #cbd5e0;
  font-weight: 500;
`;

const Input = styled.input`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 12px 14px;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: #4fd1c5;
  }
`;

const SubmitButton = styled.button`
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
  color: #ffffff;
  border: none;
  padding: 14px;
  min-height: auto;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #2f855a 0%, #276749 100%);
    color: #ffffff;
    border: none;
    box-shadow: 0 4px 14px rgba(56, 161, 105, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBox = styled.div<{ isError?: boolean }>`
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  background: ${(props) =>
    props.isError ? 'rgba(229, 62, 62, 0.15)' : 'rgba(72, 187, 120, 0.15)'};
  border: 1px solid
    ${(props) => (props.isError ? 'rgba(229, 62, 62, 0.3)' : 'rgba(72, 187, 120, 0.3)')};
  color: ${(props) => (props.isError ? '#feb2b2' : '#9ae6b4')};
  font-size: 13px;
  word-break: break-all;
`;

export interface FastTransferProps {
  hasAccount: boolean;
  recipient: string;
  onRecipientChange: (val: string) => void;
  amount: string;
  onAmountChange: (val: string) => void;
  isSending: boolean;
  onSubmit: (e: FormEvent) => void;
  statusMessage: string;
}

export const FastTransfer = ({
  hasAccount,
  recipient = '',
  onRecipientChange,
  amount = '',
  onAmountChange,
  isSending = false,
  onSubmit,
  statusMessage = '',
}: FastTransferProps) => {
  const isError =
    (statusMessage || '').startsWith('❌') || (statusMessage || '').startsWith('⚠️');

  return (
    <Card>
      <CardTitle>⚡ Transferência Rápida (ETH)</CardTitle>
      <HelperText>
        Dispara uma assinatura pelo dApp para o PQC Snap. Para envelopes 0x41, 0x44 (EIP-7702) e
        logs detalhados, abra o Snap no MetaMask Flask.
      </HelperText>

      <Form onSubmit={onSubmit}>
        <Field>
          <Label>Endereço de Destino (0x...)</Label>
          <Input
            placeholder="0x... (vazio = auto-envio)"
            value={recipient}
            onChange={(e) => onRecipientChange(e.target.value)}
          />
        </Field>

        <Field>
          <Label>Valor em ETH</Label>
          <Input
            placeholder="0.001"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </Field>

        <SubmitButton type="submit" disabled={isSending || !hasAccount}>
          {isSending ? 'Assinando e Enviando...' : '🚀 Assinar e Enviar'}
        </SubmitButton>
      </Form>

      {statusMessage ? <StatusBox isError={isError}>{statusMessage}</StatusBox> : null}
    </Card>
  );
};

export default FastTransfer;
