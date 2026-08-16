// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DrexDelegationAccount
 * @notice Contrato de implementação de Smart Account estilo Drex para uso com EIP-7702 (Delegation Code).
 * 
 * Quando uma EOA delega seu código para este contrato via transação EIP-7702 (Tipo 0x44),
 * a EOA passa a conseguir executar operações em lote (Batching), chamadas diretas e 
 * interações otimizadas com o Real Digital (Drex) e Títulos Públicos (TPFt).
 */
contract DrexDelegationAccount {

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    event Executed(address indexed target, uint256 value, bytes data);
    event BatchExecuted(uint256 count);
    event DrexOperationLogged(string operation, address indexed token, uint256 amount);

    /**
     * @notice Permite à conta receber ETH ou BRLX nativo.
     */
    receive() external payable {}

    fallback() external payable {}

    /**
     * @notice Executa uma única chamada a partir desta conta (EOA delegada).
     */
    function execute(address target, uint256 value, bytes calldata data) external payable returns (bytes memory) {
        require(msg.sender == address(this) || tx.origin == address(this), "Nao autorizado");
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Falha na execucao");
        
        emit Executed(target, value, data);
        return result;
    }

    /**
     * @notice Executa um lote (batch) de chamadas em uma única transação (ex: Approve + Swap no Drex).
     */
    function executeBatch(Call[] calldata calls) external payable returns (bytes[] memory results) {
        require(msg.sender == address(this) || tx.origin == address(this), "Nao autorizado");
        
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            require(success, "Falha na execucao do lote");
            results[i] = result;
        }

        emit BatchExecuted(calls.length);
        return results;
    }

    /**
     * @notice Helper otimizado para transferência simples de tokens no estilo Drex (ERC-20).
     */
    function drexTransfer(address token, address to, uint256 amount) external returns (bool) {
        require(msg.sender == address(this) || tx.origin == address(this), "Nao autorizado");

        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
        (bool success, bytes memory result) = token.call(data);
        require(success && (result.length == 0 || abi.decode(result, (bool))), "Falha na transferencia Drex");

        emit DrexOperationLogged("TRANSFER", token, amount);
        return true;
    }

    /**
     * @notice Retorna a versão da implementação de delegação Drex.
     */
    function version() external pure returns (string memory) {
        return "Drex-Delegation-v1.0.0";
    }
}
