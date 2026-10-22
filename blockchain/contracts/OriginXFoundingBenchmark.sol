// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract OriginXFoundingBenchmark is
    ERC721,
    AccessControl,
    Pausable
{
    bytes32 public constant MINTER_ROLE =
        keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY =
        6000;

    uint256 public constant RARE_MAX_TOKEN_ID =
        1000;

    string private baseTokenURI;

    error InvalidTokenId();
    error TokenAlreadyMinted();

    constructor(
        address admin,
        address minter,
        string memory initialBaseURI
    )
        ERC721(
            "OriginX Founding 6000",
            "OXF6000"
        )
    {
        require(
            admin != address(0),
            "INVALID_ADMIN"
        );

        require(
            minter != address(0),
            "INVALID_MINTER"
        );

        baseTokenURI =
            initialBaseURI;

        _grantRole(
            DEFAULT_ADMIN_ROLE,
            admin
        );

        _grantRole(
            MINTER_ROLE,
            minter
        );
    }

    function mint(
        address to,
        uint256 tokenId
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (
            tokenId == 0 ||
            tokenId > MAX_SUPPLY
        ) {
            revert InvalidTokenId();
        }

        if (
            _ownerOf(tokenId) != address(0)
        ) {
            revert TokenAlreadyMinted();
        }

        _safeMint(
            to,
            tokenId
        );
    }

    function pause()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _pause();
    }

    function unpause()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _unpause();
    }

    function setBaseURI(
        string calldata newBaseURI
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        baseTokenURI =
            newBaseURI;
    }

    function _baseURI()
        internal
        view
        override
        returns (
            string memory
        )
    {
        return baseTokenURI;
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721,
            AccessControl
        )
        returns (
            bool
        )
    {
        return super.supportsInterface(
            interfaceId
        );
    }
}
