import sys
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.session import SessionLocal, Base, engine
from app.services.scheduler import cron_scheduler
from app.services.notifications import NotificationService
import app.models

def test_scheduler_and_regua():
    print("1. Criando tabelas no banco de dados SQLite...")
    Base.metadata.create_all(bind=engine)
    print("PASS: Tabelas verificadas/criadas com sucesso.")

    print("\n2. Testando status do CronSchedulerService...")
    status = cron_scheduler.get_status()
    assert "target_time" in status
    assert status["target_time"] == "08:00"
    print("PASS: CronScheduler configurado com sucesso para às 08:00 AM.")

    print("\n2. Testando execução da régua de cobrança em banco limpo (zero-data)...")
    db = SessionLocal()
    try:
        stats = NotificationService.executar_regua_todos_escritorios(db)
        print("PASS: Régua de cobrança executada com sucesso:", stats)
        assert "impostos_analisados" in stats
    finally:
        db.close()

    print("\nTODOS OS TESTES DO SCHEDULER E RÉGUA PASSARAM 100%!")

if __name__ == "__main__":
    test_scheduler_and_regua()
