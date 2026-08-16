/ SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
 
contract MappingStorageTest {
    // Slot 0 - previsível (tipo simples)
    uint256 public valor1;
 
    // Slot 1 - o mapping em si "mora" nesse slot,
    // mas os VALORES dele ficam em slots imprevisíveis
    mapping(address => uint256) public balances;
 
    // Slot 2 - outro tipo simples, só pra comparação
    uint256 public valor2;
 
    function setBalance(address user, uint256 amount) external {
        balances[user] = amount;
    }
 
    receive() external payable {
        valor1 = 123;
        balances[msg.sender] = 456;
        valor2 = 789;
    }
}
