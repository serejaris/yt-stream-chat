import Navigation from "@/components/Navigation";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <Navigation />
      <main className={styles.main}>
        <div className={styles.scrollArea}>
          {children}
        </div>
      </main>
    </div>
  );
}
