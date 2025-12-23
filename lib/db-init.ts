import { initDatabase } from "@/lib/database";

let dbInitialized = false;

export async function ensureDatabaseInitialized() {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error("Ошибка инициализации базы данных:", error);
    }
  }
}





