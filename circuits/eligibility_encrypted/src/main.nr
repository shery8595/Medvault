// MedVault encrypted-mode attestation - identity + nullifier + staged FHE handle + trial/document binding.
// FHE on-chain is the sole eligibility authority; no eligible or profile_commitment public inputs.

use poseidon::poseidon::bn254;

fn main(
    secret: Field,
    scope_internal: Field,
    staged_fhe_handle: Field,
    staged_aes_key_chunk_0: Field,
    staged_aes_key_chunk_1: Field,
    staged_aes_key_chunk_2: Field,
    staged_aes_key_chunk_3: Field,
    doc_cid_hash_witness: Field,
    aes_key_ct_hash_witness: Field,
    scope: pub Field,
    nullifier: pub Field,
    result_hash: pub Field,
    fhe_stage_handle_hash: pub Field,
    criteria_schema_hash: pub Field,
    criteria_binding_hash: pub Field,
    criteria_mode: pub Field,
    doc_cid_hash: pub Field,
    aes_key_ct_hash: pub Field,
    aes_key_fhe_handle_hash_0: pub Field,
    aes_key_fhe_handle_hash_1: pub Field,
    aes_key_fhe_handle_hash_2: pub Field,
    aes_key_fhe_handle_hash_3: pub Field,
    doc_schema_hash: pub Field,
    has_document: pub Field,
) {
    let computed_nullifier = bn254::hash_2([scope_internal, secret]);
    assert(computed_nullifier == nullifier);

    assert(criteria_mode == 1);
    let _ = criteria_binding_hash;
    let _ = criteria_schema_hash;

    let computed_result_hash = bn254::hash_2([scope, secret]);
    assert(computed_result_hash == result_hash);

    assert(staged_fhe_handle == fhe_stage_handle_hash);

    if has_document == 1 {
        assert(staged_aes_key_chunk_0 == aes_key_fhe_handle_hash_0);
        assert(staged_aes_key_chunk_1 == aes_key_fhe_handle_hash_1);
        assert(staged_aes_key_chunk_2 == aes_key_fhe_handle_hash_2);
        assert(staged_aes_key_chunk_3 == aes_key_fhe_handle_hash_3);
        assert(doc_cid_hash_witness == doc_cid_hash);
        assert(aes_key_ct_hash_witness == aes_key_ct_hash);
        let _ = doc_schema_hash;
    } else {
        assert(has_document == 0);
        assert(doc_cid_hash == 0);
        assert(aes_key_ct_hash == 0);
        assert(aes_key_fhe_handle_hash_0 == 0);
        assert(aes_key_fhe_handle_hash_1 == 0);
        assert(aes_key_fhe_handle_hash_2 == 0);
        assert(aes_key_fhe_handle_hash_3 == 0);
        assert(doc_schema_hash == 0);
    }
}

#[test]
fn test_valid_encrypted_attestation() {
    let secret: Field = 12345678901234567890;
    let scope: Field = 1;
    let scope_internal: Field = 42;
    let fhe_stage: Field = 999;
    let schema: Field = 1;
    let binding_hash: Field = 424242;

    let nullifier = bn254::hash_2([scope_internal, secret]);
    let result_hash = bn254::hash_2([scope, secret]);

    main(
        secret,
        scope_internal,
        fhe_stage,
        0,
        0,
        0,
        0,
        0,
        0,
        scope,
        nullifier,
        result_hash,
        fhe_stage,
        schema,
        binding_hash,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
    );
}
