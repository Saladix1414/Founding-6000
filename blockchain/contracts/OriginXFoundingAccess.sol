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

    uint256 public adminCount;
    address public currentAdmin;

    uint256 public constant ADMIN_TRANSFER_DELAY = 48 hours;
    address public pendingAdmin;
    uint256 public adminAcceptAfter;

    string private baseTokenURI;

    bool public baseURIFrozen;

    error InvalidAdmin();
    error LastAdminProtected();
    error DirectAdminGrantDisabled();
    error InvalidPendingAdmin();
    error AdminTransferAlreadyPending();
    error AdminTransferNotPending();
    error AdminTransferNotReady();
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


    event AdminTransferStarted(address indexed candidate, uint256 readyAt);
    event AdminTransferCancelled();
    event AdminTransferAccepted(address indexed previousAdmin, address indexed newAdmin);

    function grantRole(bytes32 role, address account)
        public
        override
    {
        if (role == DEFAULT_ADMIN_ROLE) {
            revert DirectAdminGrantDisabled();
        }
        super.grantRole(role, account);
    }

    function beginAdminTransfer(address candidate)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (
            candidate == address(0) ||
            candidate == msg.sender ||
            hasRole(MINTER_ROLE, candidate) ||
            hasRole(DEFAULT_ADMIN_ROLE, candidate)
        ) {
            revert InvalidPendingAdmin();
        }
        if (pendingAdmin != address(0)) {
            revert AdminTransferAlreadyPending();
        }

        pendingAdmin = candidate;
        adminAcceptAfter = block.timestamp + ADMIN_TRANSFER_DELAY;
        emit AdminTransferStarted(candidate, adminAcceptAfter);
    }

    function cancelAdminTransfer()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (pendingAdmin == address(0)) {
            revert AdminTransferNotPending();
        }
        delete pendingAdmin;
        delete adminAcceptAfter;
        emit AdminTransferCancelled();
    }

    function acceptAdminTransfer() external {
        if (pendingAdmin == address(0) || msg.sender != pendingAdmin) {
            revert InvalidPendingAdmin();
        }
        if (block.timestamp < adminAcceptAfter) {
            revert AdminTransferNotReady();
        }

        address previousAdmin = currentAdmin;
        delete pendingAdmin;
        delete adminAcceptAfter;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousAdmin);
        currentAdmin = msg.sender;

        emit AdminTransferAccepted(previousAdmin, msg.sender);
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

        if (
            role == DEFAULT_ADMIN_ROLE &&
            account == address(0)
        ) {
            revert InvalidAdmin();
        }

        bool granted = super._grantRole(
            role,
            account
        );

        if (granted && role == DEFAULT_ADMIN_ROLE) {
            adminCount += 1;
            if (adminCount == 1) currentAdmin = account;
        }

        return granted;
    }

    function _revokeRole(
        bytes32 role,
        address account
    )
        internal
        override
        returns (bool)
    {
        if (
            role == DEFAULT_ADMIN_ROLE &&
            hasRole(role, account)
        ) {
            if (adminCount <= 1) {
                revert LastAdminProtected();
            }

            bool revoked = super._revokeRole(role, account);

            if (revoked) {
                adminCount -= 1;
                if (currentAdmin == account) {
                    currentAdmin = address(0);
                }
            }

            return revoked;
        }

        return super._revokeRole(role, account);
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
