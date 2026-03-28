import React, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import LogoWrapper from "../overlays/LogoWrapper";
import { SYSTEM_SHORT_NAME } from '../../../../shared/constants/app.js';

import { FileText, Camera, User, Settings, Compass, Newspaper as LucideNewspaper, GitCompare, BarChart3, TrendingUp, Leaf, MapPin, Database, Users, Image, Sprout, LayoutDashboard, ShieldAlert, LogOut, FlaskConical } from 'lucide-react';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const { openModal } = useConfirmation();
    const isAdmin = user && user.role === 'admin';

    const sidebarContentRef = useRef(null);
    const sidebarItemNodesRef = useRef(new Map());
    const overlayYByKeyRef = useRef(new Map());
    const recalcRafRef = useRef(null);
    const hasInitialOverlayPositionedRef = useRef(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hoveredFooterAction, setHoveredFooterAction] = useState(null);
    const [showSectionTitles, setShowSectionTitles] = useState(isSidebarOpen);
    const [isMobile, setIsMobile] = useState(false);
    const [canAnimateLayout, setCanAnimateLayout] = useState(false);
    const hoverRafRef = useRef(null);
    const pendingHoverKeyRef = useRef(null);
    const lastHoverKeyRef = useRef(null);

    const SIDEBAR_SCALE = 0.85;
    const EXPANDED_WIDTH = Math.round(256 * SIDEBAR_SCALE); // 218
    const COLLAPSED_WIDTH = Math.round(80 * SIDEBAR_SCALE); // 68
    const ITEM_SIZE = Math.round(48 * SIDEBAR_SCALE); // 41
    const ICON_SIZE = Math.round(24 * SIDEBAR_SCALE); // 20
    const LABEL_FONT_SIZE_REM = Math.max(0.8, 1 * SIDEBAR_SCALE).toFixed(2);
    const TITLE_FONT_SIZE_REM = Math.max(1.05, 1.125 * SIDEBAR_SCALE).toFixed(2);

    // Animation constants
    const SHRINK_DURATION = 0.22;
    const MOVE_DURATION = 0.22;
    const GROW_DURATION = 0.22;
    const LINE_WIDTH = 4;
    const SIDEBAR_MOTION = { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] };

    // ─── Overlay state machine ──────────────────────────────────────────────────
    // Phases: 'rect' | 'shrinking' | 'line'
    //   rect      – full rectangle on active nav (idle)
    //   shrinking – collapsing to line (hover-in from rect); Y move is queued in pendingYRef
    //   line      – thin line; moves immediately on hover; grows back to rect on hover-out
    const [phase, setPhase] = useState('rect');
    const phaseRef = useRef('rect');
    const setPhaseSync = useCallback((p) => {
        if (phaseRef.current === p) return;
        phaseRef.current = p;
        setPhase(p);
    }, []);

    const [overlayY, setOverlayY] = useState(-100);
    const overlayYRef = useRef(0);
    const pendingYRef = useRef(null);  // Y to move to once shrink finishes

    const [overlayVisible, setOverlayVisible] = useState(false);
    const overlayTargetWidth = (phase === 'line' || phase === 'shrinking') ? LINE_WIDTH : '100%';
    const recomputeOverlayPositions = useCallback(() => {
        recalcRafRef.current = null;
        const container = sidebarContentRef.current;
        if (!container) return;

        const cr = container.getBoundingClientRect();
        const nextMap = new Map();
        sidebarItemNodesRef.current.forEach((node, key) => {
            if (!node || !node.isConnected) return;
            const er = node.getBoundingClientRect();
            nextMap.set(key, (er.top - cr.top) + er.height / 2 - ITEM_SIZE / 2);
        });
        overlayYByKeyRef.current = nextMap;
    }, [ITEM_SIZE]);

    const scheduleOverlayRecalc = useCallback(() => {
        if (recalcRafRef.current !== null) return;
        recalcRafRef.current = window.requestAnimationFrame(recomputeOverlayPositions);
    }, [recomputeOverlayPositions]);

    const setSidebarItemNode = useCallback((key, node) => {
        if (!key) return;
        if (node) {
            sidebarItemNodesRef.current.set(key, node);
            scheduleOverlayRecalc();
            return;
        }
        sidebarItemNodesRef.current.delete(key);
        overlayYByKeyRef.current.delete(key);
    }, [scheduleOverlayRecalc]);

    // Helper: centered Y for a nav item key
    const getOverlayY = useCallback((key) => {
        if (!key) return null;
        const cached = overlayYByKeyRef.current.get(key);
        if (Number.isFinite(cached)) return cached;

        const container = sidebarContentRef.current;
        const el = sidebarItemNodesRef.current.get(key);
        if (!container || !el) return null;
        const cr = container.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const y = (er.top - cr.top) + er.height / 2 - ITEM_SIZE / 2;
        overlayYByKeyRef.current.set(key, y);
        return y;
    }, [ITEM_SIZE]);

    const moveY = useCallback((y) => {
        if (Math.abs((overlayYRef.current ?? 0) - y) < 0.1) return;
        overlayYRef.current = y;
        setOverlayY(y);
    }, []);

    const pendingGrowRef = useRef(false);

    // Called when WIDTH animation completes on the inner div
    const onWidthAnimComplete = useCallback(() => {
        if (phaseRef.current === 'shrinking') {
            setPhaseSync('line');
            if (pendingYRef.current !== null) {
                moveY(pendingYRef.current);
                pendingYRef.current = null;
            }
        }
    }, [setPhaseSync, moveY]);

    // Called when Y animation completes on the outer div — grow if it was a hover-out move
    const onYAnimComplete = useCallback(() => {
        if (pendingGrowRef.current) {
            pendingGrowRef.current = false;
            setPhaseSync('rect');
        }
    }, [setPhaseSync]);

    // Hover-in: shrink then move, OR if already line just move
    const runHoverInSequence = useCallback((targetKey) => {
        pendingGrowRef.current = false; // cancel any pending grow
        const targetY = getOverlayY(targetKey);
        if (targetY === null) return;
        setOverlayVisible(true);

        if (phaseRef.current === 'line') {
            // Already a line — just update target Y
            pendingYRef.current = null;
            moveY(targetY);
        } else if (phaseRef.current === 'shrinking') {
            // Currently shrinking — update pending Y, will move after shrink completes
            pendingYRef.current = targetY;
        } else {
            // rect or growing — shrink first, then move
            pendingYRef.current = targetY;
            setPhaseSync('shrinking');
        }
    }, [getOverlayY, moveY, setPhaseSync]);

    // Hover-out: move Y to active nav, then grow once Y arrives
    const runHoverOutSequence = useCallback((activeKey) => {
        if (!activeKey) { setOverlayVisible(false); return; }
        const targetY = getOverlayY(activeKey);
        if (targetY === null) return;

        // If we're already at the active item's Y (e.g. unhovering the active nav),
        // no Y animation will run, so grow back immediately.
        if (Math.abs((overlayYRef.current ?? 0) - targetY) < 0.5) {
            pendingGrowRef.current = false;
            pendingYRef.current = null;
            setPhaseSync('rect');
            return;
        }

        pendingGrowRef.current = true; // signal onYAnimComplete to grow when Y done
        pendingYRef.current = null;
        moveY(targetY);
    }, [getOverlayY, moveY, setPhaseSync]);

    const flushHoverIntent = useCallback(() => {
        hoverRafRef.current = null;
        const targetKey = pendingHoverKeyRef.current;
        pendingHoverKeyRef.current = null;
        if (!targetKey || targetKey === lastHoverKeyRef.current) return;
        lastHoverKeyRef.current = targetKey;
        runHoverInSequence(targetKey);
    }, [runHoverInSequence]);

    const queueHoverIntent = useCallback((targetKey) => {
        if (!targetKey) return;
        pendingHoverKeyRef.current = targetKey;
        if (hoverRafRef.current !== null) return;
        hoverRafRef.current = window.requestAnimationFrame(flushHoverIntent);
    }, [flushHoverIntent]);

    const clearHoverIntent = useCallback(() => {
        pendingHoverKeyRef.current = null;
        if (hoverRafRef.current !== null) {
            window.cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = null;
        }
    }, []);

    useEffect(() => {
        const onResize = () => scheduleOverlayRecalc();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [scheduleOverlayRecalc]);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useLayoutEffect(() => {
        // Enable transitions after first paint to avoid "refresh replay" animation.
        const id = window.requestAnimationFrame(() => setCanAnimateLayout(true));
        return () => window.cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        let timer;
        if (isSidebarOpen) {
            // Reveal section titles after sidebar width animation settles.
            if (canAnimateLayout) {
                timer = setTimeout(() => setShowSectionTitles(true), 320);
            } else {
                setShowSectionTitles(true);
            }
        } else {
            setShowSectionTitles(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isSidebarOpen]);

    const menuGroups = useMemo(() => {
        if (isAdmin) {
            return [
                {
                    title: 'Overview',
                    items: [
                        { name: 'Dashboard', icon: <LayoutDashboard size={24} />, path: '/admin/dashboard' },
                        { name: 'Analytics', icon: <BarChart3 size={24} />, path: '/admin/analytics' },
                    ],
                },
                {
                    title: 'Herb & Data Management',
                    items: [
                        { name: 'Herb Management', icon: <Sprout size={24} />, path: '/admin/herbs' },
                        { name: 'Phytochemicals', icon: <FlaskConical size={24} />, path: '/admin/phytochemicals' },
                        { name: 'Herb Locations', icon: <MapPin size={24} />, path: '/admin/herb-locations' },
                        {
                            name: 'ML Management',
                            icon: <Database size={24} />,
                            path: '/admin/ml-model',
                            matchPaths: ['/admin/dataset'],
                        },
                    ],
                },
                {
                    title: 'Community & Content',
                    items: [
                        { name: 'Users', icon: <Users size={24} />, path: '/admin/users' },
                        { name: 'Blog Management', icon: <LucideNewspaper size={24} />, path: '/admin/blog', matchPaths: ['/blog'] },
                        { name: 'Assets', icon: <Image size={24} />, path: '/admin/assets' },
                    ],
                },
            ];
        }

        return [
            {
                title: 'Discover',
                items: [
                    { name: 'Home', icon: <Compass size={24} />, path: '/home' },
                    { name: 'Herbs', icon: <Sprout size={24} />, path: '/herbs' },
                ],
            },
            {
                title: 'Tools',
                items: [
                    { name: 'Recommendation', icon: <FileText size={24} />, path: '/recommendation' },
                    { name: 'Safety', icon: <ShieldAlert size={24} />, path: '/safety' },
                    { name: 'Herb Compare', icon: <GitCompare size={24} />, path: '/compare' },
                    { name: 'Map', icon: <MapPin size={24} />, path: '/map' },
                    { name: 'Plant ID', icon: <Camera size={24} />, path: '/image-processing' },
                ],
            },
            {
                title: 'Content',
                items: [
                    { name: 'Blog', icon: <LucideNewspaper size={24} />, path: '/blog' },
                ],
            },
        ];
    }, [isAdmin]);

    const groupedMenuItems = useMemo(() => {
        let navIndex = 0;
        return menuGroups.map((group) => ({
            ...group,
            items: group.items.map((item) => ({
                ...item,
                navIndex: navIndex++,
            })),
        }));
    }, [menuGroups]);

    useLayoutEffect(() => {
        scheduleOverlayRecalc();
    }, [scheduleOverlayRecalc, groupedMenuItems, isSidebarOpen, showSectionTitles, isMobile]);

    const flatMenuItems = useMemo(
        () => groupedMenuItems.flatMap((group) => group.items),
        [groupedMenuItems]
    );

    const footerMenuItems = useMemo(() => [
        {
            name: 'Account', icon: <User size={24} />, action: 'account'
        },
        {
            name: 'Settings', icon: <Settings size={24} />, action: 'settings'
        },
        {
            name: 'Logout', icon: <LogOut size={24} />, action: 'logout'
        },
    ], []);

    const settingsTab = useMemo(() => {
        if (location.pathname !== '/settings') return null;
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        return tab === 'settings' ? 'settings' : 'account';
    }, [location.pathname, location.search]);

    const handleFooterAction = useCallback(async (action) => {
        if (action === 'settings') {
            navigate('/settings?tab=settings');
            return;
        }

        if (action === 'account') {
            navigate('/settings?tab=account');
            return;
        }

        if (action === 'logout') {
            if (!isAuthenticated) return;

            openModal({
                title: 'Confirm Logout',
                message: 'Are you sure you want to logout?',
                confirmText: 'Logout',
                cancelText: 'Cancel',
                type: 'danger',
                onConfirm: async () => {
                    await logout();
                    navigate('/');
                }
            });
        }
    }, [logout, navigate, isAuthenticated, openModal]);

    // Check if current route is active
    const isRouteActive = useCallback((item) => {
        if (!item?.path) return false;
        const { path, matchPaths = [] } = item;
        // Special handling for /herbs to match /herbs and /herbs/:id but not /herbs/compare
        if (path === '/herbs') {
            return location.pathname === '/herbs' || (location.pathname.startsWith('/herbs/') && !location.pathname.startsWith('/herbs/compare'));
        }
        // Special handling for /blog to match /blog and all blog sub-pages
        if (path === '/blog') {
            return location.pathname === '/blog' || location.pathname.startsWith('/blog/');
        }

        if (location.pathname === path) {
            return true;
        }

        return matchPaths.some((matchPath) => (
            location.pathname === matchPath || location.pathname.startsWith(`${matchPath}/`)
        ));
    }, [location.pathname]);

    // Get active index
    const activeIndex = useMemo(() => {
        return flatMenuItems.findIndex((item) => isRouteActive(item));
    }, [flatMenuItems, isRouteActive]);

    const footerActiveIndex = useMemo(() => {
        if (!settingsTab) return -1;
        return footerMenuItems.findIndex((item) => item.action === settingsTab);
    }, [settingsTab, footerMenuItems]);

    // Handle hover effects
    const handleItemHover = useCallback((index) => {
        const targetKey = `main-${index}`;
        setHoveredIndex((prev) => (prev === index ? prev : index));
        setHoveredFooterAction((prev) => (prev === null ? prev : null));
        queueHoverIntent(targetKey);
    }, [queueHoverIntent]);

    const handleFooterItemHover = useCallback((action, index) => {
        const targetKey = `footer-${action}`;
        setHoveredIndex((prev) => (prev === null ? prev : null));
        setHoveredFooterAction((prev) => (prev === action ? prev : action));
        queueHoverIntent(targetKey);
    }, [queueHoverIntent]);

    const handleSidebarMouseLeave = useCallback(() => {
        clearHoverIntent();
        lastHoverKeyRef.current = null;
        setHoveredIndex(null);
        setHoveredFooterAction(null);
        const activeKey = activeIndex !== -1
            ? `main-${activeIndex}`
            : footerActiveIndex !== -1
                ? `footer-${footerMenuItems[footerActiveIndex]?.action}`
                : null;
        runHoverOutSequence(activeKey);
    }, [activeIndex, footerActiveIndex, footerMenuItems, runHoverOutSequence, clearHoverIntent]);

    useEffect(() => () => clearHoverIntent(), [clearHoverIntent]);
    useEffect(() => () => {
        if (recalcRafRef.current !== null) {
            window.cancelAnimationFrame(recalcRafRef.current);
            recalcRafRef.current = null;
        }
    }, []);

    const isAnySidebarItemHovered = hoveredIndex !== null || hoveredFooterAction !== null;
    const isOverlayDanger = hoveredFooterAction === 'logout';

    // On mount, route change, or sidebar toggle: reposition overlay
    useLayoutEffect(() => {
        const activeKey = activeIndex !== -1
            ? `main-${activeIndex}`
            : footerActiveIndex !== -1
                ? `footer-${footerMenuItems[footerActiveIndex]?.action}`
                : null;

        if (!activeKey) {
            pendingGrowRef.current = false;
            setOverlayVisible(false);
            return;
        }

        const targetY = getOverlayY(activeKey);
        if (targetY === null) return;

        if (!hasInitialOverlayPositionedRef.current) {
            // Instant snap - no animation
            moveY(targetY);
            setPhaseSync('rect');
            // Force hidden until we are perfectly centered in the layout
            setOverlayVisible(true);
            pendingGrowRef.current = false;
            hasInitialOverlayPositionedRef.current = true;
        } else if (isAnySidebarItemHovered) {
            // Clicked while hovered - move line to new active Y, stay as line
            pendingGrowRef.current = false;
            moveY(targetY);
        } else {
            // During hover-out return, keep line mode while Y settles.
            if (pendingGrowRef.current && phaseRef.current !== 'rect') {
                moveY(targetY);
                return;
            }
            // Normal route change or sidebar resize - snap to full rect at new Y
            pendingGrowRef.current = false;
            moveY(targetY);
            setPhaseSync('rect');
            setOverlayVisible(true);
        }
    }, [activeIndex, footerActiveIndex, footerMenuItems, isSidebarOpen, isAnySidebarItemHovered, getOverlayY, moveY, setPhaseSync]);

    return (
        <>
            {/* Mobile backdrop */}
            {isMobile && isSidebarOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-[65]"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <AnimatePresence initial={false}>
                <motion.aside
                    data-sidebar
                    initial={false}
                    animate={
                        isMobile
                            ? { x: isSidebarOpen ? 0 : -EXPANDED_WIDTH }
                            : { width: isSidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }
                    }
                    transition={canAnimateLayout ? SIDEBAR_MOTION : { duration: 0 }}
                    className={`fixed left-0 top-0 bottom-0 h-screen flex flex-col ${isMobile ? 'z-[70]' : 'z-50'} bg-base-secondary sidebar transition-colors duration-200 ${isMobile ? '' : ''}`}
                    style={isMobile ? { width: EXPANDED_WIDTH } : {}}
                >
                    <div
                        ref={sidebarContentRef}
                        className="flex flex-col h-full p-2.5 relative"
                        onMouseLeave={handleSidebarMouseLeave}
                    >
                        {/* Overlay: outer = Y position, inner = width. Separate so they never fight. */}
                        <motion.div
                            className="absolute pointer-events-none"
                            initial={false}
                            animate={{ y: overlayY }}
                            transition={(canAnimateLayout && hasInitialOverlayPositionedRef.current) ? { y: { duration: MOVE_DURATION, ease: [0.22, 1, 0.36, 1] } } : { y: { duration: 0 } }}
                            style={{ left: 10, top: 0, height: ITEM_SIZE, width: 'calc(100% - 20px)' }}
                            onAnimationComplete={onYAnimComplete}
                        >
                            <motion.div
                                className={`h-full transition-colors duration-200 ${phase === 'line' || phase === 'shrinking' ? 'rounded-l-md' : 'rounded-md'} ${isOverlayDanger ? 'bg-interactive-danger' : 'bg-interactive-accent-indicator'}`}
                                initial={false}
                                animate={{
                                    width: overlayTargetWidth,
                                    opacity: overlayVisible ? 1 : 0,
                                }}
                                transition={canAnimateLayout
                                    ? { width: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.15 } }
                                    : { duration: 0 }
                                }
                                style={{ width: LINE_WIDTH, opacity: 0 }}
                                onAnimationComplete={onWidthAnimComplete}
                            />
                        </motion.div>
                        {/* Logo and Identity Section */}
                        <div className="relative p-0.4 overflow-hidden">
                            <Link
                                to="/"
                                className={`flex items-center rounded-2xl transition-colors duration-200 pl-0.5 gap-3 w-full`}
                                style={{ height: ITEM_SIZE }}
                            >
                                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: ITEM_SIZE, height: ITEM_SIZE }}>
                                    <LogoWrapper
                                        size="xl"
                                        transparent={true}
                                        noPadding={true}
                                    />
                                </div>
                                <AnimatePresence initial={false}>
                                    {isSidebarOpen && (
                                        <motion.span
                                            initial={canAnimateLayout ? { opacity: 0, x: -10 } : false}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="font-bold text-brand whitespace-nowrap overflow-hidden"
                                            style={{ fontSize: `${TITLE_FONT_SIZE_REM}rem` }}
                                        >
                                            {SYSTEM_SHORT_NAME}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </Link>
                        </div>

                        {/* Divider */}
                        <div className="my-3 mx-1" style={{ height: 0, borderTop: "2px dashed var(--border-strong)" }} />
                        {/* Main Navigation Wrapper */}
                        <div className="relative flex-1 p-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
                            <nav
                                className="relative flex flex-col gap-1.5"
                            >
                                {groupedMenuItems.map((group, groupIndex) => (
                                    <div key={group.title}>
                                        <div className="px-1.5 py-1">
                                            <div className="relative h-4 flex items-center overflow-hidden">
                                                <AnimatePresence initial={false}>
                                                    {showSectionTitles && (
                                                        <motion.div
                                                            initial={canAnimateLayout ? { opacity: 0, x: -10 } : false}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -10 }}
                                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                                            className="uppercase tracking-wider text-tertiary/70 font-semibold font-accent whitespace-nowrap"
                                                            style={{ fontSize: '0.75rem' }}
                                                        >
                                                            {group.title}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <motion.div
                                                    initial={false}
                                                    animate={{ marginLeft: showSectionTitles ? 8 : 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                                    className="h-px bg-border-brand flex-1"
                                                />
                                            </div>
                                        </div>

                                        {group.items.map((item) => {
                                            const isActive = isRouteActive(item);
                                            const isHovered = hoveredIndex === item.navIndex;
                                            const isHighlighted = isActive && !isAnySidebarItemHovered;
                                            const iconColorClass = isHighlighted ? 'text-on-dark' : 'text-secondary opacity-85';

                                            return (
                                                <div key={item.name} className="relative">
                                                    <Link
                                                        to={item.path}
                                                        ref={(node) => setSidebarItemNode(`main-${item.navIndex}`, node)}
                                                        data-nav-item-index={item.navIndex}
                                                        data-sidebar-item-key={`main-${item.navIndex}`}
                                                        onMouseEnter={() => handleItemHover(item.navIndex)}
                                                        className={`relative z-10 flex items-center rounded-2xl transition-colors duration-200 ${iconColorClass} pl-0.5 gap-3 w-full`}
                                                        style={{ height: ITEM_SIZE }}
                                                    >
                                                        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: ITEM_SIZE, height: ITEM_SIZE }}>
                                                            {React.cloneElement(item.icon, { size: ICON_SIZE })}
                                                        </div>
                                                        <AnimatePresence initial={false}>
                                                            {isSidebarOpen && (
                                                                <motion.span
                                                                    initial={canAnimateLayout ? { opacity: 0, x: -10 } : false}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    exit={{ opacity: 0, x: -10 }}
                                                                    className="font-medium whitespace-nowrap overflow-hidden"
                                                                    style={{ fontSize: `${LABEL_FONT_SIZE_REM}rem` }}
                                                                >
                                                                    {item.name}
                                                                </motion.span>
                                                            )}
                                                        </AnimatePresence>
                                                    </Link>
                                                    {/* Collapsed hover tooltip removed to avoid horizontal scroll */}
                                                </div>
                                            );
                                        })}

                                        {groupIndex !== groupedMenuItems.length - 1 && <div className="h-0.5" />}
                                    </div>
                                ))}
                            </nav>
                        </div>

                        {/* Divider */}
                        <div className="my-3 mx-1" style={{ height: 0, borderTop: "2px dashed var(--border-strong)" }} />

                        {/* Footer Navigation Wrapper */}
                        <div className="relative p-0.5">
                            <nav
                                className="relative flex flex-col gap-1.5"
                            >
                                {footerMenuItems.map((item, index) => {
                                    const isActive = (item.action === 'settings' && settingsTab === 'settings')
                                        || (item.action === 'account' && settingsTab === 'account');
                                    const isHovered = hoveredFooterAction === item.action;

                                    const isHighlighted = isActive && !isAnySidebarItemHovered;
                                    // Use semantic highlight text class when active
                                    const iconColorClass = isHighlighted ? 'text-on-dark' : 'text-secondary opacity-85';

                                    return (
                                        <div key={item.name} className="relative">
                                            <Link
                                                to="#/"
                                                ref={(node) => setSidebarItemNode(`footer-${item.action}`, node)}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleFooterAction(item.action);
                                                }}
                                                data-sidebar-item-key={`footer-${item.action}`}
                                                onMouseEnter={() => handleFooterItemHover(item.action, index)}
                                                className={`relative z-10 flex items-center rounded-2xl transition-colors duration-200 ${item.action === 'logout' ? (!isAuthenticated ? 'text-tertiary cursor-not-allowed opacity-50' : 'text-interactive-danger') : `${iconColorClass}`} pl-0.5 gap-3 w-full`}
                                                style={{ height: ITEM_SIZE }}
                                            >
                                                <div className="flex-shrink-0 flex items-center justify-center z-20" style={{ width: ITEM_SIZE, height: ITEM_SIZE }}>
                                                    {React.cloneElement(item.icon, { size: ICON_SIZE })}
                                                </div>
                                                <AnimatePresence initial={false}>
                                                    {isSidebarOpen && (
                                                        <motion.span
                                                            initial={canAnimateLayout ? { opacity: 0, x: -10 } : false}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -10 }}
                                                            className="font-medium whitespace-nowrap overflow-hidden"
                                                            style={{ fontSize: `${LABEL_FONT_SIZE_REM}rem` }}
                                                        >
                                                            {item.action === 'account' && user ? user.displayName : item.name}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>
                </motion.aside>
            </AnimatePresence>
        </>
    );
};

export default Sidebar;


