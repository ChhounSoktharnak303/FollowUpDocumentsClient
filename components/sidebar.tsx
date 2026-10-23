"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderOpen,
  LogOut,
  Settings2,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/context";

const navItems = [
  { href: "/", key: "navToday", icon: CalendarDays },
  { href: "/cases", key: "navCases", icon: FolderOpen },
  { href: "/clients", key: "navClients", icon: Users },
  { href: "/settings", key: "navSettings", icon: Settings2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { tr } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image
          src="/logo.png"
          alt={tr("officeLabel")}
          width={800}
          height={182}
          priority
          className="sidebar-logo"
        />
        <div className="brand-copy min-w-0">
          <div className="brand-title truncate">{tr("appName")}</div>
          <div className="brand-subtitle truncate">{tr("appSubtitle")}</div>
        </div>
      </div>

      <nav className="nav-rail" aria-label={tr("menu")}>
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
              title={tr(item.key)}
            >
              <Icon size={17} strokeWidth={1.7} className="shrink-0" />
              <span className="nav-label truncate">{tr(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="nav-item w-full text-left"
            title={tr("logout")}
          >
            <LogOut size={17} strokeWidth={1.7} className="shrink-0" />
            <span className="nav-label truncate">{tr("logout")}</span>
          </button>
        </form>
        <p className="sidebar-meta">{tr("officeLabel")}</p>
      </div>
    </aside>
  );
}
