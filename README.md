# 🛡️ PQC-SNAP: Carteira Pós-Quântica para MetaMask (Besu)

[![License](https://img.shields.io/badge/License-Apache%202.0%20%7C%20MIT--0-blue.svg)](LICENSE.APACHE2)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.6.0-green.svg)](https://nodejs.org/)
[![Yarn](https://img.shields.io/badge/Yarn-3.2.1-blue.svg)](https://yarnpkg.com/)
[![MetaMask Snaps](https://img.shields.io/badge/MetaMask%20Snaps-SDK%20v10.3-orange.svg)](https://docs.metamask.io/snaps/)

**PQC-SNAP** é um [MetaMask Snap](https://metamask.io/snaps/) (acompanhado de um dApp simples em Gatsby) que adiciona suporte a **Criptografia Pós-Quântica (PQC)** e **Assinaturas Híbridas** no MetaMask Flask para redes **Besu PQC**.

Com ele é possível derivar contas com **ML-DSA-44**, **Falcon-512**, **Híbridas (ECDSA + PQC)** e **ECDSA clássica (BIP-44)**, assinar envelopes flexíveis (`0x41`, `0x42`, `0x44`) e clássicos (`0x00`, `0x01`, `0x02`), e inspecionar bytes, gas e recibos diretamente nos **Logs do Snap**.

---

## 🔐 Algoritmos Suportados e Gas Base (Besu PR #55)

| Tipo de Conta | Código DSA | Tamanho Est. da Assinatura | Gas Base (Besu PR #55) | Envelopes Compatíveis |
| :--- | :--- | :--- | :--- | :--- |
| **ECDSA Clássica (BIP-44)** | `0x0010` (`SECP256K1`) | `65 B` | `21.000` | `0x00`, `0x01`, `0x02` |
| **Falcon-512 Pura** | `0x0040` (`FALCON512`) | `~666 B` | `46.511` | `0x41`, `0x42`, `0x44` |
| **Híbrida (ECDSA + Falcon-512)** | `0x0070` (`SECP256K1-FALCON512`) | `~731 B` | `50.369` | `0x41`, `0x42`, `0x44` |
| **ML-DSA-44 Pura** | `0x0030` (`MLDSA44`) | `2.420 B` | `82.553` | `0x41`, `0x42`, `0x44` |
| **Híbrida (ECDSA + ML-DSA-44)** | `0x0060` (`SECP256K1-MLDSA44`) | `2.485 B` | `86.102` | `0x41`, `0x42`, `0x44` |

---

## 📋 Pré-requisitos

1. **Node.js**: `v18.6.0` ou superior.
2. **Yarn**: `3.2.1` (habilite via `corepack enable` caso ainda não esteja ativo).
3. **MetaMask Flask**: extensão de desenvolvimento do MetaMask ([metamask.io/flask](https://metamask.io/flask/)).
   > **Importante:** desative a extensão padrão do MetaMask no mesmo perfil do navegador (ou use um perfil separado apenas com o MetaMask Flask) para evitar conflito no provedor `window.ethereum`.
4. **Nó [Besu PQC](https://github.com/venturusbr/besu-pqc-ppi)** em execução:
   - Por padrão, o projeto aponta para `http://localhost:8545`.
   - Por política de segurança do Snap (`packages/snap/src/constants.ts`), conexões `http://` sem TLS são aceitas apenas para `localhost`, `127.0.0.1` e `[::1]`; endpoints remotos devem usar `https://`.

---

## 🚀 Como Instalar e Iniciar o MetaMask Snap

### 1. Instalar dependências e subir o ambiente local

```bash
git clone https://github.com/venturusbr/pqc-snap
cd PQC-SNAP
yarn install
yarn start
```

O comando `yarn start` sobe os dois serviços em paralelo:
- **Servidor do Snap (`packages/snap`):** `http://localhost:8080`
- **dApp Companion (`packages/site`):** `http://localhost:8000`

### 2. Instalar o Snap no MetaMask Flask

1. Abra o navegador com o **MetaMask Flask** instalado e desbloqueado.
2. Acesse `http://localhost:8000`.
3. Clique em **"Conectar MetaMask Snap"**.
4. Aprove a caixa de diálogo do MetaMask Flask concedendo as permissões solicitadas (Keyring, diálogo, armazenamento de estado, página inicial e acesso à rede).
5. Quando o cabeçalho exibir **"Snap Conectado"**, abra a interface completa da carteira dentro da própria extensão:
   - Abra o **MetaMask Flask** → clique no menu (`⋮` ou ícone de configurações) → **Snaps** → **PQC Account**.

---

## ⚙️ Configuração Inicial da Carteira (dentro do Snap)

Dentro da Home Page do **PQC Account** no MetaMask Flask:

1. **Configurar o nó Besu (opcional se não for `http://localhost:8545`):**
   - No menu principal, seção **🌐 Configurar IP**, informe a URL do nó e clique em **💾 Salvar IP da Rede**.
   - Para confirmar que o nó responde aos algoritmos pós-quânticos, abra **🌐 3. DSAs Suportados na Rede (Besu)** e clique em **🔍 Consultar DSAs Suportados**.
2. **Inicializar a frase de recuperação (24 palavras):**
   - Acesse **➕ 2. Gerar / Backup / Adicionar Contas**.
   - Clique em **🔑 Gerar Nova Frase (24 palavras)** (anote a frase) ou **📥 Importar Frase Existente**.
3. **Derivar contas de teste:**
   - Na mesma aba, derive pelo menos uma conta PQC/híbrida — por exemplo **➕ Derivar Conta Híbrida (ECDSA + ML-DSA)** ou **➕ Derivar Conta Híbrida (ECDSA + Falcon-512)** — e, se quiser comparar custos de gas/bytes na demonstração, derive também **⚙️ Derivar Conta Clássica Padrão (ECDSA BIP-44)**.
4. **Abastecer a conta com ETH de teste:**
   - Abra **📋 1. Informações da Conta & Saldos**, copie o **Endereço Ethereum** da conta derivada e envie ETH de teste a partir de uma conta pré-financiada do seu nó Besu.
   - Clique em **🔄 Consultar / Atualizar Saldos** para confirmar o saldo (ou clique em **🔄 Atualizar** no dApp em `http://localhost:8000`).

---

## 📜 Contrato de Demonstração (`DemoCounter.sol`)

Para apresentações e testes de **Flexible Access List (`0x41`)** e **Flexible Code Delegation (`0x44` / EIP-7702)**, o repositório inclui o contrato mínimo [`DemoCounter.sol`](DemoCounter.sol):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DemoCounter {
    uint256 public counter; // slot 0 -> selector counter() = 0x61bc221a
    mapping(address => uint256) public userCalls; // slot 1 -> slot dinâmico via keccak256
    string public lastMessage; // slot 2 -> registra nota da delegação EIP-7702

    event Incremented(address indexed executor, address indexed caller, uint256 newCounter);
    event DelegationPing(
        address indexed selfAddress,
        address indexed caller,
        uint256 newCounter,
        string message
    );

    receive() external payable {
        counter += 1;
        userCalls[msg.sender] += 1;
        emit Incremented(address(this), msg.sender, counter);
    }

    function increment() external returns (uint256) {
        counter += 1;
        userCalls[msg.sender] += 1;
        emit Incremented(address(this), msg.sender, counter);
        return counter;
    }

    function pingDelegation(string calldata note) external returns (string memory) {
        counter += 1;
        lastMessage = note;
        emit DelegationPing(address(this), msg.sender, counter, note);
        return note;
    }
}
```

### Por que esse contrato funciona bem para demonstrar `0x41` e `0x44`?

- **Para `0x41` (Access List):** ao chamar `increment()` (ou até enviar ETH direto para o contrato via `receive()`), a execução lê e escreve tanto no slot fixo `0` (`counter`) quanto no slot derivado `keccak256(msg.sender, 1)` (`userCalls`). Assim, o `eth_createAccessList` do Besu devolve o endereço do contrato e duas `storageKeys` distintas pré-aquecidas antes de assinar.
- **Para `0x44` (Code Delegation / EIP-7702):** ao delegar sua EOA para o `DemoCounter` e chamar `pingDelegation("...")`, a EOA passa a executar o bytecode do contrato **usando o próprio endereço (`address(this) == EOA`) e o próprio storage**. O evento `DelegationPing` mostra `selfAddress = EOA` e o bytecode da EOA passa a iniciar com o designador EIP-7702 `0xef0100...`.
- **Compatibilidade nativa com o Snap:** `counter()` (`0x61bc221a`), `increment()` (`0xd09de08a`) e `pingDelegation(string)` (`0x5c36b186`) usam exatamente os seletores já configurados na aba de contratos do Snap.

### Deploy rápido do contrato

- **Via Remix IDE (recomendado para demonstração):** abra [remix.ethereum.org](https://remix.ethereum.org), cole o código de [`DemoCounter.sol`](DemoCounter.sol), compile em Solidity `0.8.20+`, selecione em *Deploy & Run* o ambiente **Custom - External Http Provider** (`http://localhost:8545`) e faça o deploy. Copie o endereço gerado.

---

## 🧪 Passo a Passo para Testar as Transações

### Teste 1 — Transferência rápida pelo dApp (`http://localhost:8000`)

Ideal para mostrar a integração entre um site/dApp comum e a carteira PQC:

1. Em `http://localhost:8000`, clique em **🔄 Atualizar** no card **Conta PQC Ativa** para exibir a conta criada no Snap e o saldo no Besu.
2. Em **⚡ Transferência Rápida (ETH)**, informe um **Endereço de Destino** (ou deixe em branco para auto-envio) e um **Valor em ETH** (ex: `0.001`).
3. Clique em **🚀 Assinar e Enviar**.
4. Aprove o popup de confirmação do MetaMask Flask (o dApp envia automaticamente com envelope `0x42` para contas PQC/híbridas ou `0x02` para ECDSA clássica).
5. Confira o hash retornado e abra a aba **🕵️ 6. Logs e Inspetor de Transações** no Snap para ver a telemetria completa.

### Teste 2 — Transação PQC (`0x42`) e comparação com Clássica (`0x02` / `0x00`)

Dentro do Snap (**Snaps → PQC Account → ⚡ 4. Fazer Transações PQC**):

1. Selecione a **Conta Remetente** (ex: Híbrida `ECDSA + ML-DSA-44` ou `Falcon-512`).
2. Escolha o **Tipo de Transação**: `Flexible EIP-1559 (0x42)`.
3. Preencha o destinatário (ou deixe vazio para auto-envio) e o valor em ETH.
4. Clique em **🚀 Assinar e Transmitir (0x42)** e confirme no diálogo do MetaMask.
5. *(Para demonstrar a diferença de tamanho e gas)* Repita selecionando uma conta **ECDSA Clássica** com `EIP-1559 Dynamic Fee (0x02)` e compare os dois registros na aba de Logs.

### Teste 3 — Flexible Access List (`0x41`) com `DemoCounter`

Dentro do Snap (**📑 5. Contratos, Delegação e Blob**):

1. Em **🎯 Contrato Alvo**, cole o endereço do `DemoCounter` recém-implantado e clique em **💾 Definir Contrato**.
2. Clique em **🔢 Consultar Contador (`counter()`)** — o valor inicial exibido será `0`.
3. Na seção **🚀 Transação 0x41 (Flexible Access List)**, confira o calldata `0xd09de08a` (`increment()`) e clique em **🚀 Transmitir Transação 0x41**.
4. Observe no diálogo de confirmação e no resultado:
   - O Snap consulta `eth_createAccessList` no Besu antes da assinatura.
   - A **Access List Utilizada** mostra o endereço do contrato e os storage keys aquecidos (slot `0` do `counter` e slot do `userCalls[msg.sender]`).
5. Clique novamente em **🔢 Consultar Contador (`counter()`)** para confirmar que o contador subiu para `1`.

### Teste 4 — Flexible Code Delegation (`0x44` / EIP-7702) e Revogação

Na mesma aba **📑 5. Contratos, Delegação e Blob**:

1. Garanta que o **Contrato Alvo** está apontando para o endereço do `DemoCounter`.
2. Em **🛡️ Gerenciar Delegação de Conta**, clique em **🔍 Verificar Bytecode Delegado da Conta** — inicialmente deve retornar `0x` (EOA pura, sem código).
3. Em **🧬 Transação 0x44 (Flexible Code Delegation / EIP-7702)**, escreva uma nota (ex: `Apresentacao PQC`) e clique em **🧬 Delegar Código & Executar (0x44)**.
4. Aprove a confirmação no MetaMask Flask. O Snap assina a autorização EIP-7702 com a chave da conta e envia a transação `0x44` chamando `pingDelegation(string)` no endereço da própria EOA.
5. Ao concluir, clique em **🔍 Verificar Bytecode Delegado da Conta**: o código da EOA no Besu agora começa com `0xef0100` seguido do endereço do `DemoCounter`.
6. *(Opcional)* Para demonstrar a revogação, clique em **❌ Revogar Delegação (Voltar para EOA 0x)** — o bytecode volta para `0x`.

### Teste 5 — Inspecionar e comparar tudo nos Logs do Snap

Abra **🕵️ 6. Logs e Inspetor de Transações** no Snap:

- Veja o **Comparativo Rápido de Envelopes** com todas as transações executadas na sessão (tanto pelo Snap quanto pelo dApp), comparando lado a lado `Envelope`, `DSA`, tamanho da assinatura (`Sig`), tamanho do RLP final (`RLP`), `Gas Base` vs `Gas Usado` e status do bloco.
- Selecione qualquer entrada no menu **Entrada do Histórico** para visualizar:
  - Separação de bytes (`PubKey`, assinatura `ECDSA`, assinatura `PQC`, `Preimage`, `Tx RLP Final`).
  - Trilha de execução passo a passo com latência em ms.
  - Artefatos hexadecimais copiáveis (`txHash`, `signingHash`, `Preimage RLP`, assinatura completa, `Access List` e `Authorization List`).

---

## 🏗️ Arquitetura do Repositório

```text
PQC-SNAP/
├── DemoCounter.sol              # Contrato mínimo para demonstrações 0x41 e 0x44
├── packages/
│   ├── snap/                    # MetaMask Snap (TypeScript & Snap JSX)
│   │   ├── src/
│   │   │   ├── crypto/          # Derivação de chaves (BIP-39/44, ML-DSA-44, Falcon-512) e assinaturas
│   │   │   ├── keyring/         # Implementação da MetaMask Keyring API
│   │   │   ├── transactions/    # RLP, preimages e gás PR #55 (0x00–0x02, 0x41, 0x42, 0x44)
│   │   │   ├── rpc/             # Cliente JSON-RPC para Besu
│   │   │   ├── ui/              # Home Page (6 abas), diálogos e LogsTab
│   │   │   └── index.tsx        # Entrypoint RPC, Keyring, HomePage e UserInput
│   │   └── snap.manifest.json   # Permissões e manifesto do Snap
│   └── site/                    # dApp companion mínimo em Gatsby (conexão + transferência rápida)
└── package.json                 # Scripts do monorepo
```

---

## 🛠️ Scripts Disponíveis

Execute na raiz do repositório:

| Comando | Descrição |
| :--- | :--- |
| `yarn start` | Sobe o servidor do Snap (`:8080`) e o dApp (`:8000`) em paralelo |
| `yarn build` | Compila `packages/snap` (atualizando o `shasum` do manifesto) e `packages/site` |
| `yarn test` | Executa a suíte de testes Jest em `packages/snap` |
| `yarn lint` | Verifica ESLint e Prettier em todo o monorepo |
| `yarn lint:fix` | Corrige formatação e problemas automáticos de lint |

---

## 🔧 Solução de Problemas Comuns

- **Botão "Instalar MetaMask Flask" aparece mesmo com a extensão instalada:** verifique se o MetaMask padrão está ativo no mesmo perfil do navegador e desative-o, recarregando `http://localhost:8000`.
- **Alterações no código do Snap não aparecem no MetaMask:** rode `yarn build` (ou reinicie `yarn start`) e clique em **Reconectar** no dApp em `http://localhost:8000`.
- **Erro de conexão RPC com servidor remoto:** por segurança, `http://` só é aceito em `localhost`, `127.0.0.1` e `[::1]`. Para nós remotos, use `https://` ou ajuste `INSECURE_RPC_ALLOWED_HOSTS` em `packages/snap/src/constants.ts` antes do build.
- **Transação rejeitada por saldo insuficiente:** envie ETH de teste para o endereço exibido na aba `1` do Snap (lembre-se de que transações PQC têm gas base maior que `21.000`).

---

## 📄 Licença

Este projeto possui licença dupla:
- **MIT-0** ([LICENSE.MIT0](LICENSE.MIT0))
- **Apache-2.0** ([LICENSE.APACHE2](LICENSE.APACHE2))
