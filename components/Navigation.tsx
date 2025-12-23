"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navigation.module.css";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <Link
        href="/transmissions"
        className={`${styles.link} ${pathname === "/transmissions" ? styles.active : ""}`}
      >
        Трансляции
      </Link>
      <Link
        href="/overview"
        className={`${styles.link} ${pathname === "/overview" ? styles.active : ""}`}
      >
        Обзор
      </Link>
      <Link
        href="/videos"
        className={`${styles.link} ${pathname === "/videos" ? styles.active : ""}`}
      >
        Видео
      </Link>
      <Link
        href="/quota"
        className={`${styles.link} ${pathname === "/quota" ? styles.active : ""}`}
      >
        Квота
      </Link>
    </nav>
  );
}

