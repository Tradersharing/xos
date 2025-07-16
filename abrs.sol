// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./Xsatufileaja.sol";  // defines Tradersharingfactory, TradersharingPair, IERC20Minimal

contract Tradersharing {
    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "Router: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Router: ZERO_ADDRESS");
    }

    function pairFor(address tokenA, address tokenB) internal view returns (address pair) {
        pair = Tradersharingfactory(factory).getPair(tokenA, tokenB);
    }

    function quote(uint amountA, uint reserveA, uint reserveB)
        public
        pure
        returns (uint amountB)
    {
        require(amountA > 0, "Router: INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "Router: INSUFFICIENT_LIQUIDITY");
        amountB = (amountA * reserveB) / reserveA;
    }

    function getAmountsOut(uint amountIn, address[] memory path)
        public
        view
        returns (uint[] memory amounts)
    {
        require(path.length >= 2, "Router: INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveA, uint reserveB) = _getReserves(path[i], path[i+1]);
            amounts[i+1] = quote(amounts[i], reserveA, reserveB);
        }
    }

    function getAmountsIn(uint amountOut, address[] memory path)
        public
        view
        returns (uint[] memory amounts)
    {
        require(path.length >= 2, "Router: INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint i = path.length - 1; i > 0; i--) {
            (uint reserveA, uint reserveB) = _getReserves(path[i-1], path[i]);
            amounts[i-1] = (amounts[i] * reserveA) / reserveB + 1;
        }
    }

    function _getReserves(address tokenA, address tokenB)
        internal
        view
        returns (uint reserveA, uint reserveB)
    {
        address pair = pairFor(tokenA, tokenB);
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1) = TradersharingPair(pair).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public returns (uint amountA, uint amountB, uint liquidity) {
        require(block.timestamp <= deadline, "Router: EXPIRED");

        (amountA, amountB) = _computeLiquidityAmounts(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );

        address pair = pairFor(tokenA, tokenB);
        require(pair != address(0), "Router: PAIR_NOT_EXISTS");

        require(
            IERC20Minimal(tokenA).transferFrom(msg.sender, pair, amountA),
            "Router: TRANSFER_FAILED_A"
        );
        require(
            IERC20Minimal(tokenB).transferFrom(msg.sender, pair, amountB),
            "Router: TRANSFER_FAILED_B"
        );

        liquidity = TradersharingPair(pair).mint(to);
    }

    function _computeLiquidityAmounts(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal view returns (uint amountA, uint amountB) {
        address pair = pairFor(tokenA, tokenB);
        if (pair == address(0)) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            (uint reserveA, uint reserveB) = _getReserves(tokenA, tokenB);

            // ✅ Fix divide by zero untuk kasus reserve awal masih 0
            if (reserveA == 0 && reserveB == 0) {
                amountA = amountADesired;
                amountB = amountBDesired;
            } else {
                uint amountBOptimal = (amountADesired * reserveB) / reserveA;
                if (amountBOptimal <= amountBDesired) {
                    require(amountBOptimal >= amountBMin, "Router: INSUFFICIENT_B_AMOUNT");
                    (amountA, amountB) = (amountADesired, amountBOptimal);
                } else {
                    uint amountAOptimal = (amountBDesired * reserveA) / reserveB;
                    require(amountAOptimal >= amountAMin, "Router: INSUFFICIENT_A_AMOUNT");
                    (amountA, amountB) = (amountAOptimal, amountBDesired);
                }
            }
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public returns (uint amountA, uint amountB) {
        require(block.timestamp <= deadline, "Router: EXPIRED");

        address pair = pairFor(tokenA, tokenB);
        require(pair != address(0), "Router: PAIR_NOT_EXISTS");

        require(
            IERC20Minimal(pair).transferFrom(msg.sender, pair, liquidity),
            "Router: TRANSFER_FAILED_LP"
        );

        (amountA, amountB) = TradersharingPair(pair).burn(to);

        require(amountA >= amountAMin, "Router: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "Router: INSUFFICIENT_B_AMOUNT");
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Router: EXPIRED");

        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");

        require(
            IERC20Minimal(path[0]).transferFrom(msg.sender, pairFor(path[0], path[1]), amountIn),
            "Router: TRANSFER_FAILED"
        );

        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Router: EXPIRED");

        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "Router: EXCESSIVE_INPUT_AMOUNT");

        require(
            IERC20Minimal(path[0]).transferFrom(msg.sender, pairFor(path[0], path[1]), amounts[0]),
            "Router: TRANSFER_FAILED"
        );

        _swap(amounts, path, to);
    }

    function _swap(
        uint[] memory amounts,
        address[] memory path,
        address _to
    ) internal {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0
                ? (uint(0), amountOut)
                : (amountOut, uint(0));
            address to = i < path.length - 2 ? pairFor(output, path[i + 2]) : _to;
            TradersharingPair(pairFor(input, output)).swap(amount0Out, amount1Out, to);
        }
    }
}
