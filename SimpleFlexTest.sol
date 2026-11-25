// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleFlexTest
 * @notice Contrato simples e versátil projetado para testar:
 * 
 * 1. Transação 0x41 (Flexible Access List - PQC/Híbrida):
 *    - Possui slots de storage previsíveis e funções que realizam leitura/escrita,
 *      permitindo gerar e validar a `accessList` (pre-warming de slots de storage).
 * 
 * 2. Code Flex Delegation (0x44 / EIP-7702 - PQC/Híbrida):
 *    - Serve como contrato de implementação delegada para EOAs.
 *    - Quando uma EOA delega seu código para este contrato, a EOA pode executar
 *      chamadas arbitrárias (`execute`, `executeBatch`) ou registrar dados no seu próprio storage (`pingDelegation`).
 */
contract SimpleFlexTest {

    // --- SLOTS DE STORAGE (Ideais para testar o Access List 0x41) ---
    // Slot 0: uint256 simples
    uint256 public counter;
    
    // Slot 1: mapping (gera slots criptográficos previsíveis via keccak256)
    mapping(address => uint256) public userBalances;
    
    // Slot 2: string / mensagem de texto
    string public lastMessage;

    // --- EVENTOS DE TESTE ---
    event StateUpdated(address indexed sender, uint256 newCounter, uint256 userBalance, string message);
    event DelegationPing(address indexed selfAddress, address indexed caller, string message);
    event CallExecuted(address indexed target, uint256 value, bytes data, bool success);
    event BatchExecuted(uint256 count);

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    receive() external payable {}
    fallback() external payable {}

    // =========================================================================
    // 1. FUNÇÕES PARA TESTAR A TRANSAÇÃO 0x41 (FLEXIBLE ACCESS LIST)
    // =========================================================================

    /**
     * @notice Incrementa apenas o contador (Slot 0).
     */
    function increment() external returns (uint256) {
        counter += 1;
        return counter;
    }

    /**
     * @notice Atualiza o saldo do usuário no mapping (Slot 1).
     */
    function setUserBalance(address user, uint256 amount) external {
        userBalances[user] = amount;
    }

    /**
     * @notice Modifica múltiplos slots ao mesmo tempo (Slot 0, Slot 1 e Slot 2).
     * Excelente para testar o gerador de Access List, pois a RPC do Besu retornará
     * múltiplos storageKeys para inclusão no envelope 0x41.
     */
    function multiTouch(uint256 newCounter, uint256 newBalance, string calldata newMessage) external {
        counter = newCounter;
        userBalances[msg.sender] = newBalance;
        lastMessage = newMessage;

        emit StateUpdated(msg.sender, newCounter, newBalance, newMessage);
    }

    // =========================================================================
    // 2. FUNÇÕES PARA TESTAR CODE FLEX DELEGATION (0x44 / EIP-7702)
    // =========================================================================

    /**
     * @notice Testa a delegação diretamente na EOA.
     * Quando uma EOA delega para este contrato e você chama a EOA,
     * `address(this)` será o endereço da própria EOA e o storage gravado
     * pertencerá à EOA.
     */
    function pingDelegation(string calldata note) external returns (string memory) {
        lastMessage = note;
        emit DelegationPing(address(this), msg.sender, note);
        return note;
    }

    /**
     * @notice Permite à conta delegada executar uma chamada arbitrária (Account Abstraction).
     * Exemplo: a EOA transfere tokens ou interage com outro contrato em seu próprio nome.
     */
    function execute(address target, uint256 value, bytes calldata data) external payable returns (bytes memory) {
        require(msg.sender == address(this) || tx.origin == address(this), "Nao autorizado");

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Falha na execucao da chamada");

        emit CallExecuted(target, value, data, success);
        return result;
    }

    /**
     * @notice Permite à conta delegada executar um lote (batch) de chamadas em uma única transação.
     */
    function executeBatch(Call[] calldata calls) external payable returns (bytes[] memory results) {
        require(msg.sender == address(this) || tx.origin == address(this), "Nao autorizado");

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            require(success, "Falha na chamada do lote");
            results[i] = result;
        }

        emit BatchExecuted(calls.length);
        return results;
    }

    /**
     * @notice Retorna a versão de teste.
     */
    function version() external pure returns (string memory) {
        return "SimpleFlexTest-v1.0.0";
    }
}
