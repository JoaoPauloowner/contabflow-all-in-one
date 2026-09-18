import io
import sys
from pathlib import Path
from fastapi import UploadFile, HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.storage import StorageService

def test_magic_bytes():
    # 1. Valid PDF
    pdf_data = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj"
    file_pdf = UploadFile(filename="teste.pdf", file=io.BytesIO(pdf_data))
    name, ext = StorageService.validate_file(file_pdf)
    assert ext == ".pdf"
    print("PASS: Arquivo PDF valido aceito.")

    # 2. Executable disguised as PDF
    malware_data = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"
    file_fake = UploadFile(filename="malware.pdf", file=io.BytesIO(malware_data))
    try:
        StorageService.validate_file(file_fake)
        assert False, "Deveria ter bloqueado o arquivo executavel disfarçado!"
    except HTTPException as e:
        assert e.status_code == 400
        print("PASS: Executavel disfarçado bloqueado com sucesso (HTTP 400):", e.detail)

    # 3. Valid XML
    xml_data = b'<?xml version="1.0" encoding="UTF-8"?><nfeProc></nfeProc>'
    file_xml = UploadFile(filename="nfe.xml", file=io.BytesIO(xml_data))
    name, ext = StorageService.validate_file(file_xml)
    assert ext == ".xml"
    print("PASS: Arquivo XML valido aceito.")

    # 4. Valid OFX
    ofx_data = b"OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>"
    file_ofx = UploadFile(filename="extrato.ofx", file=io.BytesIO(ofx_data))
    name, ext = StorageService.validate_file(file_ofx)
    assert ext == ".ofx"
    print("PASS: Arquivo OFX valido aceito.")

    # 5. Linux ELF binary disguised as PNG
    elf_data = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    file_elf = UploadFile(filename="foto.png", file=io.BytesIO(elf_data))
    try:
        StorageService.validate_file(file_elf)
        assert False, "Deveria ter bloqueado o ELF disfarçado de PNG!"
    except HTTPException as e:
        assert e.status_code == 400
        print("PASS: Binario ELF disfarçado bloqueado com sucesso (HTTP 400):", e.detail)

    print("\nTODOS OS TESTES DE MAGIC BYTES PASSARAM COM 100% DE SUCESSO!")

if __name__ == "__main__":
    test_magic_bytes()
