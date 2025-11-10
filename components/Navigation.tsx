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
    </nav>
  );
}

