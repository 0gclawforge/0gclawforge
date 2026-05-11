// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
    function verifyTransferProof(
        uint256 tokenId,
        address from,
        address to,
        bytes32 oldMetadataHash,
        bytes32 newMetadataHash,
        bytes calldata proof
    ) external view returns (bool);
}

/**
 * @title MockOracle
 * @notice Test oracle that accepts all proofs. Replace with real TEE oracle on mainnet.
 */
contract MockOracle is IOracle {
    bool public verificationResult = true;

    function setVerificationResult(bool _result) external {
        verificationResult = _result;
    }

    function verifyProof(bytes calldata) external view override returns (bool) {
        return verificationResult;
    }

    function verifyTransferProof(
        uint256,
        address,
        address,
        bytes32,
        bytes32,
        bytes calldata
    ) external view override returns (bool) {
        return verificationResult;
    }
}
