# Metadata for analyzer
ALGO_METADATA = {
    "name": "Custom_SP_BlockCipher",
    "key_size": 256,
    "rounds": 12,
    "has_sbox": True,
    "structure": "Substitution-Permutation Network",
    "quantum_claims": False
}

# Simple S-box (non-linear substitution)
SBOX = [(i * 7 + 3) % 256 for i in range(256)]
INV_SBOX = [0] * 256
for i in range(256):
    INV_SBOX[SBOX[i]] = i


def rotate_left(val, shift):
    return ((val << shift) & 0xFF) | (val >> (8 - shift))


def key_schedule(key: bytes, rounds: int):
    # Expand key into round keys
    round_keys = []
    k = list(key)

    for r in range(rounds):
        new_key = []
        for i in range(len(k)):
            val = SBOX[k[i] ^ (r + i)]
            val = rotate_left(val, (i + r) % 8)
            new_key.append(val)
        round_keys.append(bytes(new_key[:16]))  # 16-byte round key
        k = new_key

    return round_keys


def encrypt(key: bytes, plaintext: bytes) -> bytes:
    # Pad plaintext to multiple of 16 bytes
    pad_len = 16 - (len(plaintext) % 16)
    plaintext += bytes([pad_len] * pad_len)

    round_keys = key_schedule(key, 12)
    ciphertext = b''

    for i in range(0, len(plaintext), 16):
        block = list(plaintext[i:i+16])

        for r in range(12):
            rk = round_keys[r]

            # Substitution + Key mixing
            for j in range(16):
                block[j] = SBOX[block[j] ^ rk[j]]

            # Permutation (mix positions)
            block = block[::2] + block[1::2]

            # Rotation diffusion
            for j in range(16):
                block[j] = rotate_left(block[j], (j + r) % 8)

        ciphertext += bytes(block)

    return ciphertext


def decrypt(key: bytes, ciphertext: bytes) -> bytes:
    round_keys = key_schedule(key, 12)
    plaintext = b''

    for i in range(0, len(ciphertext), 16):
        block = list(ciphertext[i:i+16])

        for r in reversed(range(12)):
            rk = round_keys[r]

            # Reverse rotation
            for j in range(16):
                block[j] = rotate_left(block[j], 8 - ((j + r) % 8))

            # Reverse permutation
            temp = [0]*16
            temp[::2] = block[:8]
            temp[1::2] = block[8:]
            block = temp

            # Reverse substitution + key mixing
            for j in range(16):
                block[j] = INV_SBOX[block[j]] ^ rk[j]

        plaintext += bytes(block)

    # Remove padding
    pad_len = plaintext[-1]
    return plaintext[:-pad_len]