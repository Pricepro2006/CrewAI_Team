import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const navItems = [
    {
      path: "/",
      label: "Dashboard",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      path: "/chat",
      label: "Chat",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      path: "/agents",
      label: "Agents",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="7"
            r="4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      path: "/email-dashboard",
      label: "Email Management",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="22,6 12,13 2,6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      path: "/web-scraping",
      label: "Web Scraping",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 12C21 16.97 16.97 21 12 21S3 16.97 3 12S7.03 3 12 3S21 7.03 21 12Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3.6 9H20.4" stroke="currentColor" strokeWidth="2" />
          <path d="M3.6 15H20.4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 3C13.5 5.5 13.5 8.5 12 12C10.5 15.5 10.5 18.5 12 21"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 3C10.5 5.5 10.5 8.5 12 12C13.5 15.5 13.5 18.5 12 21"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      path: "/knowledge-base",
      label: "Knowledge Base",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M7 3.5A2.5 2.5 0 0 1 9.5 1H12.5A2.5 2.5 0 0 1 15 3.5V19.5A2.5 2.5 0 0 1 12.5 22H9.5A2.5 2.5 0 0 1 7 19.5V3.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      path: "/vector-search",
      label: "Vector Search",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" />
          <path d="M11 6V16" stroke="currentColor" strokeWidth="2" />
          <path d="M6 11H16" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      path: "/settings",
      label: "Settings",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.4 15C19.1277 15.6171 19.0728 16.3078 19.2426 16.9618C19.4125 17.6157 19.7968 18.1947 20.337 18.606L20.447 18.696C20.8405 19.0894 21.0622 19.6228 21.0622 20.179C21.0622 20.7352 20.8405 21.2686 20.447 21.662C20.0536 22.0555 19.5202 22.2772 18.964 22.2772C18.4078 22.2772 17.8744 22.0555 17.481 21.662L17.394 21.552C16.9827 21.0118 16.4037 20.6275 15.7498 20.4576C15.0958 20.2878 14.4051 20.3427 13.788 20.615C13.1828 20.8747 12.6812 21.3259 12.3612 21.8985C12.0412 22.4711 11.9208 23.1329 12.018 23.778L12.048 24C11.9899 24.5304 11.7276 25.0185 11.3126 25.3625C10.8975 25.7066 10.3607 25.88 9.80402 25.846C9.24738 25.812 8.71586 25.5733 8.31122 25.174C7.90659 24.7747 7.65729 24.2421 7.60802 23.686L7.57802 23.464C7.50711 22.8091 7.21292 22.2003 6.74528 21.7393C6.27763 21.2783 5.66521 21.9326 5.00502 21.994C4.34484 22.0554 3.67398 21.82 3.15202 21.334L3.04202 21.244C2.64858 20.8506 2.42686 20.3172 2.42686 19.761C2.42686 19.2048 2.64858 18.6714 3.04202 18.278L3.15202 18.191C3.69219 17.7798 4.07651 17.2008 4.24638 16.5468C4.41624 15.8929 4.36135 15.2021 4.08902 14.585C3.82925 13.9798 3.37809 13.4782 2.80547 13.1582C2.23285 12.8382 1.57105 12.7178 0.925017 12.815L0.703017 12.845C0.144256 12.9093 -0.394459 12.6601 -0.73863 12.1754C-1.0828 11.6907 -1.18566 11.0289 -0.704668 10.4434C-0.223679 9.85792 0.442718 9.41763 1.00002 9.20002L1.22202 9.17002C1.86685 9.09821 2.47843 8.80402 2.95804 8.33639C3.43765 7.86875 3.55835 7.25633 3.49702 6.59602C3.43569 5.93571 2.70002 5.40502 2.21402 5.00002L2.12402 4.89002C1.73058 4.49658 1.50886 3.96324 1.50886 3.40702C1.50886 2.8508 1.73058 2.31746 2.12402 1.92402C2.51746 1.53058 3.0508 1.30886 3.60702 1.30886C4.16324 1.30886 4.69658 1.53058 5.09002 1.92402L5.18002 2.03402C5.59119 2.57419 6.17015 2.95851 6.82414 3.12838C7.47812 3.29824 8.16889 3.24335 8.78602 2.97102H8.78802C9.39312 2.71125 9.89428 2.26009 10.2143 1.68747C10.5343 1.11485 10.6547 0.453046 10.557 -0.192984L10.527 -0.414984C10.4627 -0.945366 10.6024 -1.4839 10.9166 -1.89853C11.2309 -2.31316 11.6924 -2.56856 12.199 -2.60296C12.7056 -2.63736 13.2171 -2.44654 13.6072 -2.06976C13.9972 -1.69298 14.2313 -1.1614 14.253 -0.604984L14.283 -0.382984C14.3549 0.262046 14.6491 0.870866 15.1167 1.33162C15.5843 1.79237 16.1967 2.07656 16.857 2.13502C17.5172 2.19348 18.188 1.9217 18.705 1.37002L18.815 1.26002C19.2084 0.86658 19.7418 0.644859 20.298 0.644859C20.8542 0.644859 21.3876 0.86658 21.781 1.26002C22.1744 1.65346 22.3962 2.1868 22.3962 2.74302C22.3962 3.29924 22.1744 3.83258 21.781 4.22602L21.671 4.33602C21.1308 4.85267 20.859 5.52345 20.9175 6.18364C20.9759 6.84382 21.2601 7.45624 21.721 7.92402C22.3261 8.46419 22.935 8.60002 23.581 8.50002L23.803 8.47002C24.3594 8.52928 24.8709 8.79253 25.2355 9.20716C25.6001 9.6218 25.791 10.1583 25.77 10.715C25.749 11.2716 25.5182 11.7915 25.124 12.1815C24.7298 12.5716 24.2013 12.8026 23.645 12.827L23.423 12.857C22.7681 12.9289 22.1593 13.2231 21.6985 13.6907C21.2378 14.1584 20.9536 14.7708 20.892 15.431C20.8305 16.0912 21.1023 16.762 21.654 17.279L21.764 17.389C22.1574 17.7824 22.3792 18.3158 22.3792 18.872C22.3792 19.4282 22.1574 19.9616 21.764 20.355C21.3706 20.7484 20.8372 20.9702 20.281 20.9702C19.7248 20.9702 19.1914 20.7484 18.798 20.355L18.688 20.245C18.2768 19.7048 17.6978 19.3205 17.0438 19.1506C16.3899 18.9808 15.6991 19.0357 15.082 19.308V19.308Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">{!isCollapsed && "TypeScript AI"}</h2>
        <div className="sidebar-subtitle">
          {!isCollapsed && "Enterprise Assistant"}
        </div>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label="Toggle sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12H21M3 6H21M3 18H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "active" : ""}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!isCollapsed && (
              <span className="sidebar-label">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="sidebar-status">
            <div className="status-indicator"></div>
            <span className="status-text">System Ready</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
