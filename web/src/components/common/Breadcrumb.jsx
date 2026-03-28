import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumb = () => {
  const location  = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);
  const cameFromMyBlogs = location.state?.fromMyBlogs === true;

  const [herbLabel, setHerbLabel]     = useState('');
  const [herbReady, setHerbReady]     = useState(false);
  const [blogLabel, setBlogLabel]     = useState('');
  const [blogReady, setBlogReady]     = useState(false);

  useEffect(() => {
    const isHerbDetail = pathnames[0] === 'herbs' && pathnames.length === 2 && pathnames[1] !== 'compare';
    const isBlogView   = pathnames[0] === 'blog'  && pathnames.length === 2
      && !['create','my-blogs','edit'].includes(pathnames[1]);

    if (!isHerbDetail) { setHerbLabel(''); setHerbReady(false); }
    if (!isBlogView)   { setBlogLabel(''); setBlogReady(false); }
  }, [location.pathname]);

  useEffect(() => {
    const onHerb = ({ detail }) => {
      if (detail?.scientificName) { setHerbLabel(detail.scientificName); setHerbReady(true); }
    };
    const onBlog = ({ detail }) => {
      if (detail?.title) { setBlogLabel(detail.title); setBlogReady(true); }
    };
    window.addEventListener('herb-breadcrumb-label', onHerb);
    window.addEventListener('blog-breadcrumb-label', onBlog);
    return () => {
      window.removeEventListener('herb-breadcrumb-label', onHerb);
      window.removeEventListener('blog-breadcrumb-label', onBlog);
    };
  }, []);

  const ROOT_LABEL = {
    home: 'Home', herbs: 'Herbs', blog: 'Blog',
    recommendation: 'Recommendation', map: 'Map',
    'image-processing': 'Plant ID', admin: 'Admin',
  };

  const crumbs = [];

  if (!pathnames.length || ['/', '/landing'].includes(location.pathname)) return null;

  const root = pathnames[0];
  const rootLabel = ROOT_LABEL[root] ?? (root.charAt(0).toUpperCase() + root.slice(1));

  if (root !== 'admin') crumbs.push({ label: rootLabel, path: `/${root}`, active: pathnames.length === 1 });

  if (pathnames.length > 1) {
    const sub = pathnames[1];

    if (root === 'blog') {
      if (sub === 'create') { crumbs.push({ label: 'Create Blog', path: `/${root}/create`, active: true }); }
      else if (sub === 'my-blogs') { crumbs.push({ label: 'My Blogs', path: `/${root}/my-blogs`, active: true }); }
      else if (sub === 'edit') {
        if (cameFromMyBlogs) crumbs.push({ label: 'My Blogs', path: `/${root}/my-blogs`, active: false });
        crumbs.push({ label: 'Edit', path: location.pathname, active: true });
      } else {
        if (cameFromMyBlogs) crumbs.push({ label: 'My Blogs', path: `/${root}/my-blogs`, active: !blogReady });
        if (!blogReady) { if (crumbs[0]) crumbs[0].active = true; return renderCrumbs(crumbs); }
        crumbs.push({ label: blogLabel || 'View Blog', path: location.pathname, active: true });
      }
    } else if (root === 'herbs' && pathnames.length === 2) {
      if (sub === 'compare') {
        crumbs.push({ label: 'Compare Herbs', path: location.pathname, active: true });
      } else {
        if (!herbReady) { if (crumbs[0]) crumbs[0].active = true; return renderCrumbs(crumbs); }
        crumbs.push({ label: herbLabel || 'Herb Detail', path: location.pathname, active: true });
      }
    } else if (root === 'admin') {
      const ADMIN_LABEL = {
        dashboard: 'Dashboard', analytics: 'Analytics', herbs: 'Herb Management',
        phytochemicals: 'Phytochemicals', 'herb-locations': 'Herb Locations',
        dataset: 'ML Management', 'ml-model': 'ML Management',
        users: 'Users', blog: 'Blog Management', assets: 'Assets', 'landing-assets': 'Assets',
      };
      const subLabel = ADMIN_LABEL[sub] ?? (sub.charAt(0).toUpperCase() + sub.slice(1));
      crumbs.push({ label: subLabel, path: `/${root}/${sub}`, active: pathnames.length === 2 });
      if (pathnames.length > 2) {
        const slug = decodeURIComponent(pathnames[2]);
        crumbs.push({
          label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
          path: location.pathname,
          active: true,
        });
      }
    }
  }

  return renderCrumbs(crumbs);
};

function renderCrumbs(crumbs) {
  if (!crumbs.length) return null;
  return (
    <nav aria-label="breadcrumb" className="breadcrumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          {c.active
            ? <span className="breadcrumb-active">{c.label}</span>
            : <Link to={c.path} className="breadcrumb-link">{c.label}</Link>
          }
        </React.Fragment>
      ))}
    </nav>
  );
}

export default Breadcrumb;
