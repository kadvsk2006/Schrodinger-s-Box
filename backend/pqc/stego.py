# pyright: reportMissingImports=false
"""
stego.py — Quantum-Seeded Image Steganography

Hides AES-256-GCM + Kyber/McEliece encrypted ciphertexts inside normal images.
Uses true quantum entropy (QRNG) as a seed to randomly distribute the payload 
across the image's Least Significant Bits (LSB), defeating classical steganalysis.
"""

from __future__ import annotations
import io
import random
from PIL import Image

def embed_data(image_bytes: bytes, payload: bytes, seed: bytes) -> bytes:
    """
    Scatters `payload` bits into the LSBs of the image using a quantum `seed`.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    pixels = img.load()
    width, height = img.size
    
    # Prepend 4-byte length header to payload
    length_bytes = len(payload).to_bytes(4, 'big')
    full_payload = length_bytes + payload

    # Convert payload to bit list
    bits = []
    for byte in full_payload:
        for i in range(8):
            bits.append((byte >> (7 - i)) & 1)

    max_capacity = width * height * 3
    if len(bits) > max_capacity:
        raise ValueError(f"Payload too large. Max capacity: {max_capacity} bits. Payload: {len(bits)} bits.")

    # Quantum-seeded pseudo-random permutation of pixel coordinates
    # We use python's random with the quantum seed. (True QRNG is used for the seed itself).
    random.seed(seed)
    
    # Generate coordinates
    coords = [(x, y, c) for x in range(width) for y in range(height) for c in range(3)]
    random.shuffle(coords)
    
    # Embed
    for i, bit in enumerate(bits):
        x, y, c = coords[i]
        r, g, b = pixels[x, y]
        color_channels = [r, g, b]
        
        # Modify the specific channel LSB
        current_val = color_channels[c]
        new_val = (current_val & ~1) | bit
        color_channels[c] = new_val
        
        pixels[x, y] = tuple(color_channels)
        
    # Save to bytes
    out_io = io.BytesIO()
    img.save(out_io, format="PNG")
    return out_io.getvalue()


def extract_data(image_bytes: bytes, seed: bytes) -> bytes:
    """
    Extracts the scattered payload bits from the image LSBs using the quantum `seed`.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    pixels = img.load()
    width, height = img.size
    
    random.seed(seed)
    coords = [(x, y, c) for x in range(width) for y in range(height) for c in range(3)]
    random.shuffle(coords)

    def get_bit(idx: int) -> int:
        x, y, c = coords[idx]
        return pixels[x, y][c] & 1

    # Extract length header (first 32 bits)
    length = 0
    for i in range(32):
        bit = get_bit(i)
        length = (length << 1) | bit

    max_bytes = width * height * 3 // 8
    if length > max_bytes or length < 0:
        raise ValueError("Invalid length header detected. Likely wrong seed or corrupted image.")

    # Extract payload
    payload = bytearray()
    for b_idx in range(length):
        byte_val = 0
        for i in range(8):
            bit_idx = 32 + (b_idx * 8) + i
            bit = get_bit(bit_idx)
            byte_val = (byte_val << 1) | bit
        payload.append(byte_val)

    return bytes(payload)
