"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navigation.module.css";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/transmissions", label: "Трансляции", icon: "📺" },
    { href: "/overview", label: "Обзор", icon: "📊" },
    { href: "/videos", label: "Видео", icon: "🎬" },
    { href: "/quota", label: "Квота API", icon: "🛡️" },
  ];

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>YT</span>
        <span className={styles.logoText}>Studio</span>
      </div>
      
      <div className={styles.menu}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${pathname === item.href ? styles.active : ""}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.version}>v1.0.0</div>
      </div>
    </nav>
  );
}

