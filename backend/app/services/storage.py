"""
Serviço de Armazenamento de Arquivos do ContabFlow All-in-One.

Responsável por:
- Validação de extensão e tamanho de arquivo para segurança contra uploads maliciosos.
- Salvamento isolado por tenant/cliente em diretórios seguros com nomes de arquivo hashados (UUID).
- Cálculo de tamanho do arquivo e retorno de metadados para o modelo de Documento.
"""
import shutil
import uuid
from pathlib import Path
from typing import Tuple, Union
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings


class StorageService:
    @staticmethod
    def validate_magic_bytes(header: bytes, file_ext: str) -> bool:
        """
        Verifica a assinatura binária real do arquivo (Magic Bytes) para garantir
        que não se trata de executável ou script malicioso disfarçado.
        """
        # Bloqueio imediato se contiver cabeçalho PE (Windows Executable "MZ") ou ELF (Linux "\x7fELF")
        if header.startswith(b"MZ") or header.startswith(b"\x7fELF"):
            return False

        if file_ext == ".pdf":
            return header.startswith(b"%PDF-")
        elif file_ext == ".png":
            return header.startswith(b"\x89PNG\r\n\x1a\n")
        elif file_ext in [".jpg", ".jpeg"]:
            return header.startswith(b"\xff\xd8\xff")
        elif file_ext == ".webp":
            return header.startswith(b"RIFF") and b"WEBP" in header[:16]
        elif file_ext in [".xml", ".ofx", ".txt", ".csv"]:
            # Arquivos de texto e dados fiscais não devem conter bytes nulos binários nos primeiros 512 bytes
            if b"\x00" in header[:512]:
                return False
            if file_ext == ".xml":
                trimmed = header.strip()
                return trimmed.startswith(b"<?xml") or trimmed.startswith(b"<")
            if file_ext == ".ofx":
                trimmed = header.strip()
                return (
                    b"OFXHEADER" in header
                    or b"<OFX>" in header
                    or trimmed.startswith(b"<?xml")
                    or trimmed.startswith(b"<")
                )
            return True

        return True

    @staticmethod
    def validate_file(file: UploadFile) -> Tuple[str, str]:
        """
        Valida a extensão e a integridade binária (Magic Bytes) do arquivo enviado.
        """
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nome de arquivo não informado",
            )

        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extensão de arquivo não permitida ({file_ext}). Permitidos: {', '.join(settings.ALLOWED_EXTENSIONS)}",
            )

        # Inspeção de Magic Bytes (lê até 1024 bytes e reseta o ponteiro do stream)
        file.file.seek(0)
        header = file.file.read(1024)
        file.file.seek(0)

        if not StorageService.validate_magic_bytes(header, file_ext):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inconsistência de segurança: o conteúdo binário não corresponde ao formato declarado ({file_ext}). Upload rejeitado por prevenção a malwares.",
            )

        return file.filename, file_ext

    @staticmethod
    def save_upload(
        file: UploadFile,
        tenant_id: str,
        cliente_id: str,
    ) -> Tuple[str, str, int]:
        """
        Salva o arquivo em diretório isolado por tenant e cliente:
        uploads/{tenant_id}/{cliente_id}/{uuid_hash}.ext
        Retorna (file_path_relativo, original_name, file_size).
        """
        original_name, file_ext = StorageService.validate_file(file)

        # Diretório seguro isolado por tenant
        upload_dir = Path(settings.UPLOAD_DIR) / tenant_id / cliente_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = f"{uuid.uuid4().hex}{file_ext}"
        target_path = upload_dir / safe_filename

        # Gravação em disco com cálculo do tamanho
        file.file.seek(0)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = target_path.stat().st_size
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        if file_size > max_bytes:
            # Remove arquivo se exceder o limite
            if target_path.exists():
                target_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"O arquivo excede o limite máximo permitido de {settings.MAX_UPLOAD_SIZE_MB}MB",
            )

        # Salva o path relativo para portabilidade
        relative_path = str(target_path.as_posix())
        return relative_path, original_name, file_size

    @staticmethod
    def _get_fernet() -> "Fernet":
        """Instancia o cifrador simétrico AES-256 (Fernet) derivado da chave mestra do sistema."""
        import base64
        import hashlib
        from cryptography.fernet import Fernet
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
        return Fernet(key)

    @staticmethod
    def encrypt_field(plaintext: str) -> str:
        """Cifra um dado sensível a nível de aplicação (AES-256) antes da persistência no banco."""
        if not plaintext:
            return ""
        fernet = StorageService._get_fernet()
        return fernet.encrypt(plaintext.encode()).decode()

    @staticmethod
    def decrypt_field(ciphertext: str) -> str:
        """Decifra um dado cifrado com AES-256."""
        if not ciphertext:
            return ""
        try:
            fernet = StorageService._get_fernet()
            return fernet.decrypt(ciphertext.encode()).decode()
        except Exception:
            return ciphertext

    @staticmethod
    def purgar_arquivo(caminho: Union[str, Path]) -> bool:
        """
        Remove com segurança um arquivo temporário de disco (LGPD Compliance: Zero-Retention).
        Retorna True se removido com sucesso.
        """
        try:
            p = Path(caminho)
            if p.exists() and p.is_file():
                p.unlink()
                return True
        except Exception:
            pass
        return False
