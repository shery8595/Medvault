// MedVault compliance attestation circuit - binds Semaphore identity + profile commitment
// to a Zama FHE staged result handle and trial policy (Zama remains the compute authority).
//
// Public inputs: scope, nullifier, profile_commitment, result_hash, eligible,
//                fhe_stage_handle_hash, criteria_schema_hash, + 9 trial criteria fields,
//                criteria_mode (0 = plaintext criteria, 1 = encrypted criteria echo binding),
//                + 8 document binding fields (doc_cid_hash, aes_key_ct_hash, 4x aes_key_fhe_handle_hash,
//                doc_schema_hash, has_document).

use poseidon::poseidon::bn254;

fn bool_field(b: bool) -> Field {
    if b { 1 } else { 0 }
}

fn profile_commitment_hash(
    commitment: Field,
    age: u8,
    gender: bool,
    weight: u16,
    height: u8,
    has_diabetes: bool,
    hb_level: u16,
    is_smoker: bool,
    has_hypertension: bool,
    profile_salt: Field,
) -> Field {
    let a = age as Field;
    let g = bool_field(gender);
    let w = weight as Field;
    let h = height as Field;
    let d = bool_field(has_diabetes);
    let hb = hb_level as Field;
    let s = bool_field(is_smoker);
    let bp = bool_field(has_hypertension);
    let left = bn254::hash_3([commitment, a, g]);
    let mid = bn254::hash_3([w, h, d]);
    let right = bn254::hash_3([hb, s, bp]);
    let salted_right = bn254::hash_3([right, profile_salt, 0]);
    bn254::hash_3([left, mid, salted_right])
}

fn compute_eligible(
    age: u8,
    gender: bool,
    weight: u16,
    height: u8,
    has_diabetes: bool,
    hb_level: u16,
    is_smoker: bool,
    has_hypertension: bool,
    min_age: u8,
    max_age: u8,
    requires_diabetes: bool,
    min_hb: u16,
    gender_requirement: u8,
    min_height: u8,
    max_weight: u16,
    requires_non_smoker: bool,
    requires_normal_bp: bool,
) -> bool {
    let age_ok = (age >= min_age) & (age <= max_age);
    let diabetes_ok = if requires_diabetes { has_diabetes } else { true };
    let hb_ok = hb_level >= min_hb;
    let gender_ok = if gender_requirement == 1 {
        gender
    } else if gender_requirement == 2 {
        !gender
    } else {
        true
    };
    let height_ok = if min_height > 0 { height >= min_height } else { true };
    let weight_ok = if max_weight > 0 { weight <= max_weight } else { true };
    let smoking_ok = if requires_non_smoker { !is_smoker } else { true };
    let bp_ok = if requires_normal_bp { !has_hypertension } else { true };

    age_ok & diabetes_ok & hb_ok & gender_ok & height_ok & weight_ok & smoking_ok & bp_ok
}

fn main(
    secret: Field,
    scope_internal: Field,
    commitment: Field,
    age: u8,
    gender: bool,
    weight: u16,
    height: u8,
    has_diabetes: bool,
    hb_level: u16,
    is_smoker: bool,
    has_hypertension: bool,
    profile_salt: Field,
    staged_fhe_handle: Field,
    decrypted_eligible: Field,
    criteria_binding_hash: Field,
    staged_aes_key_chunk_0: Field,
    staged_aes_key_chunk_1: Field,
    staged_aes_key_chunk_2: Field,
    staged_aes_key_chunk_3: Field,
    doc_cid_hash_witness: Field,
    aes_key_ct_hash_witness: Field,
    scope: pub Field,
    nullifier: pub Field,
    profile_commitment: pub Field,
    result_hash: pub Field,
    eligible: pub Field,
    fhe_stage_handle_hash: pub Field,
    criteria_schema_hash: pub Field,
    min_age: pub Field,
    max_age: pub Field,
    requires_diabetes: pub Field,
    min_hb: pub Field,
    gender_requirement: pub Field,
    min_height: pub Field,
    max_weight: pub Field,
    requires_non_smoker: pub Field,
    requires_normal_bp: pub Field,
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
    let computed_profile = profile_commitment_hash(
        commitment,
        age,
        gender,
        weight,
        height,
        has_diabetes,
        hb_level,
        is_smoker,
        has_hypertension,
        profile_salt,
    );
    assert(computed_profile == profile_commitment);

    let computed_nullifier = bn254::hash_2([scope_internal, secret]);
    assert(computed_nullifier == nullifier);

    if criteria_mode == 0 {
        let min_age_u8 = min_age as u8;
        let max_age_u8 = max_age as u8;
        let requires_diabetes_b = requires_diabetes == 1;
        let min_hb_u16 = min_hb as u16;
        let gender_req_u8 = gender_requirement as u8;
        let min_height_u8 = min_height as u8;
        let max_weight_u16 = max_weight as u16;
        let requires_non_smoker_b = requires_non_smoker == 1;
        let requires_normal_bp_b = requires_normal_bp == 1;

        let eligibility_result = compute_eligible(
            age,
            gender,
            weight,
            height,
            has_diabetes,
            hb_level,
            is_smoker,
            has_hypertension,
            min_age_u8,
            max_age_u8,
            requires_diabetes_b,
            min_hb_u16,
            gender_req_u8,
            min_height_u8,
            max_weight_u16,
            requires_non_smoker_b,
            requires_normal_bp_b,
        );

        let eligible_field = bool_field(eligibility_result);
        assert(eligible == eligible_field);
    } else {
        // Encrypted criteria: FHE is compute authority on-chain; bind echo of on-chain criteria hash at index 7.
        //
        // BINDING DEFERRAL (Phase 2): The contract is NOT yet the binding authority for `decrypted_eligible`.
        // This branch trusts the prover's witness - a dishonest client could lie about the decrypted bit.
        // On-chain `FHE.checkSignatures` binding was deferred because Zama SDK exposes a KMS `decryptionProof`
        // only via public decrypt (`makePubliclyDecryptable`), which would re-leak eligibility pre-finalize.
        // Prerequisite to revive binding: user-decrypt to PublicDecryptVerification signature API, or
        // `FHE.requestDecryption` async-callback pattern. Until then, frontend + relayer are trusted.
        assert(eligible == decrypted_eligible);
        assert(min_age == criteria_binding_hash);
    }

    let computed_result_hash = bn254::hash_3([eligible, scope, secret]);
    assert(computed_result_hash == result_hash);

  // FHE-bound attestation: witness must know the staged Zama ebool handle field.
  assert(staged_fhe_handle == fhe_stage_handle_hash);
  let _ = criteria_schema_hash;

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
fn test_valid_eligible_attestation() {
    let secret: Field = 12345678901234567890;
    let commitment: Field = 555;
    let scope: Field = 1;
    let scope_internal: Field = 42;
    let age: u8 = 30;
    let gender = true;
    let weight: u16 = 70;
    let height: u8 = 175;
    let has_diabetes = false;
    let hb_level: u16 = 140;
    let is_smoker = false;
    let has_hypertension = false;
    let profile_salt: Field = 7777;
    let fhe_stage: Field = 999;
    let schema: Field = 1;

    let nullifier = bn254::hash_2([scope_internal, secret]);
    let profile_commitment = profile_commitment_hash(
        commitment, age, gender, weight, height, has_diabetes, hb_level, is_smoker, has_hypertension, profile_salt,
    );
    let elig_field: Field = 1;
    let result_hash = bn254::hash_3([elig_field, scope, secret]);

    main(
        secret,
        scope_internal,
        commitment,
        age,
        gender,
        weight,
        height,
        has_diabetes,
        hb_level,
        is_smoker,
        has_hypertension,
        profile_salt,
        fhe_stage,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        scope,
        nullifier,
        profile_commitment,
        result_hash,
        elig_field,
        fhe_stage,
        schema,
        18,
        65,
        0,
        120,
        0,
        0,
        0,
        0,
        0,
        0,
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

#[test]
fn test_valid_encrypted_criteria_attestation() {
    let secret: Field = 12345678901234567890;
    let commitment: Field = 555;
    let scope: Field = 1;
    let scope_internal: Field = 42;
    let age: u8 = 30;
    let gender = true;
    let weight: u16 = 70;
    let height: u8 = 175;
    let has_diabetes = false;
    let hb_level: u16 = 140;
    let is_smoker = false;
    let has_hypertension = false;
    let profile_salt: Field = 7777;
    let fhe_stage: Field = 999;
    let schema: Field = 1;
    let binding_hash: Field = 424242;

    let nullifier = bn254::hash_2([scope_internal, secret]);
    let profile_commitment = profile_commitment_hash(
        commitment, age, gender, weight, height, has_diabetes, hb_level, is_smoker, has_hypertension, profile_salt,
    );
    let elig_field: Field = 1;
    let result_hash = bn254::hash_3([elig_field, scope, secret]);

    main(
        secret,
        scope_internal,
        commitment,
        age,
        gender,
        weight,
        height,
        has_diabetes,
        hb_level,
        is_smoker,
        has_hypertension,
        profile_salt,
        fhe_stage,
        elig_field,
        binding_hash,
        0,
        0,
        0,
        0,
        0,
        0,
        scope,
        nullifier,
        profile_commitment,
        result_hash,
        elig_field,
        fhe_stage,
        schema,
        binding_hash,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
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
