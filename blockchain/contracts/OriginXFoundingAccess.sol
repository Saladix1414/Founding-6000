// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract OriginXFoundingAccess is
    ERC721,
    AccessControl,
    Pausable
{
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE =
        keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY =
        6000;

    uint256 public totalMinted;

    string private baseTokenURI;

    bool public baseURIFrozen;

    error InvalidAdmin();
    error InvalidMinter();
    error AuthorityCollision();
    error InvalidTokenId();
    error TokenAlreadyMinted();
    error EmptyBaseURI();
    error BaseURIAlreadyFrozen();

    event BaseURIUpdated(
        string previousBaseURI,
        string newBaseURI
    );

    event BaseURIFrozen(
        string finalBaseURI
    );

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
        if (admin == address(0)) {
            revert InvalidAdmin();
        }

        if (minter == address(0)) {
            revert InvalidMinter();
        }

        if (admin == minter) {
            revert AuthorityCollision();
        }

        if (
            bytes(initialBaseURI).length == 0
        ) {
            revert EmptyBaseURI();
        }

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
            _ownerOf(tokenId) !=
            address(0)
        ) {
            revert TokenAlreadyMinted();
        }

        unchecked {
            ++totalMinted;
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
        if (baseURIFrozen) {
            revert BaseURIAlreadyFrozen();
        }

        if (
            bytes(newBaseURI).length == 0
        ) {
            revert EmptyBaseURI();
        }

        string memory previous =
            baseTokenURI;

        baseTokenURI =
            newBaseURI;

        emit BaseURIUpdated(
            previous,
            newBaseURI
        );
    }

    function freezeBaseURI()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (baseURIFrozen) {
            revert BaseURIAlreadyFrozen();
        }

        baseURIFrozen =
            true;

        emit BaseURIFrozen(
            baseTokenURI
        );
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override
        returns (
            string memory
        )
    {
        _requireOwned(
            tokenId
        );

        return string.concat(
            baseTokenURI,
            tokenId.toString(),
            ".json"
        );
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

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override
        whenNotPaused
        returns (
            address
        )
    {
        return super._update(
            to,
            tokenId,
            auth
        );
    }

    function _grantRole(
        bytes32 role,
        address account
    )
        internal
        override
        returns (
            bool
        )
    {
        if (
            role == MINTER_ROLE &&
            hasRole(
                DEFAULT_ADMIN_ROLE,
                account
            )
        ) {
            revert AuthorityCollision();
        }

        if (
            role == DEFAULT_ADMIN_ROLE &&
            hasRole(
                MINTER_ROLE,
                account
            )
        ) {
            revert AuthorityCollision();
        }

        return super._grantRole(
            role,
            account
        );
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
