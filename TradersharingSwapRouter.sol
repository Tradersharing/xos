// SPDX-License-Identifier: MIT
pragma solidity =0.5.16;

import "./FreeSwapLibrary.sol";
import "./interfaces/IFreeSwapFactory.sol";
import "./interfaces/IFreeSwapPair.sol";
import "./interfaces/IERC20.sol";
import "./libraries/SafeMath.sol";

contract TradersharingSwapRouter {
    address public factory;

    constructor(address _factory) public {
        factory = _factory;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external {
        require(path.length >= 2, "Router: INVALID_PATH");

        IERC20(path[0]).transferFrom(msg.sender, FreeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn);
        _swap(path, to);

        uint balanceOut = IERC20(path[path.length - 1]).balanceOf(to);
        require(balanceOut >= amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    function _swap(address[] memory path, address _to) internal {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            address pair = FreeSwapLibrary.pairFor(factory, input, output);
            (uint reserveIn, uint reserveOut) = FreeSwapLibrary.getReserves(factory, input, output);
            uint amountInput = IERC20(input).balanceOf(pair) - reserveIn;
            uint amountOutput = FreeSwapLibrary.getAmountOut(amountInput, reserveIn, reserveOut);

            (address token0,) = FreeSwapLibrary.sortTokens(input, output);
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));

            IFreeSwapPair(pair).swap(
                amount0Out,
                amount1Out,
                i < path.length - 2 ? FreeSwapLibrary.pairFor(factory, output, path[i + 2]) : _to,
                new bytes(0)
            );
        }
    }
}
