// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ITraderSharingPair {
    function initialize(address token0, address token1) external;
}

contract TraderSharingFactory {
    address public feeTo;
    address public feeToSetter;
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Identical tokens");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address");
        require(getPair[token0][token1] == address(0), "Pair exists");

        bytes memory bytecode = type(TraderSharingPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        ITraderSharingPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "Not authorized");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _setter) external {
        require(msg.sender == feeToSetter, "Not authorized");
        feeToSetter = _setter;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }
}

contract TraderSharingPair {
    address public token0;
    address public token1;

    function initialize(address _token0, address _token1) external {
        require(token0 == address(0) && token1 == address(0), "Already initialized");
        token0 = _token0;
        token1 = _token1;
    }
}
