import React from 'react';

const CustomButton = ({
  variant = 'blink',
  children,
  className = '',
  onClick,
  hoverColor = '#0072b1', // default LinkedIn blue
  logo,
  ...props
}) => {
  if (variant === 'blink') {
    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pop-up {
            0%   { transform: translateY(0)    scale(1);    box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
            60%  { transform: translateY(-6px) scale(1.04); box-shadow: 0 14px 28px rgba(0,0,0,0.22); }
            100% { transform: translateY(-4px) scale(1.03); box-shadow: 0 10px 22px rgba(0,0,0,0.18); }
          }

          @keyframes pop-down {
            0%   { transform: translateY(-4px) scale(1.03); box-shadow: 0 10px 22px rgba(0,0,0,0.18); }
            100% { transform: translateY(0)    scale(1);    box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
          }

          .btn-shine {
            position: relative;
            margin: 0;
            padding: 17px 35px;
            outline: none;
            text-decoration: none;
            display: block;
            width: 100%;
            text-align: center;
            cursor: pointer;
            text-transform: uppercase;
            background-color: var(--base-primary);
            border: 1px solid var(--border-brand);
            border-radius: 10px;
            color: var(--text-brand);
            font-weight: 400;
            font-family: var(--font-core);
            z-index: 0;
            overflow: hidden;
            /* Resting state */
            transform: translateY(0) scale(1);
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            animation: pop-down 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            transition: box-shadow 0.35s ease;
          }

          .btn-shine:hover {
            box-shadow: 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 3px rgba(255,255,255,0.3);
            transition: box-shadow 0.2s ease;
          }

          .btn-shine:active {
            animation: none;
            transform: translateY(1px) scale(0.97);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2), inset 0 2px 6px rgba(0,0,0,0.18);
            transition: transform 0.08s ease, box-shadow 0.08s ease;
          }

          .btn-shine .btn-span {
            color: var(--text-brand);
            font-weight: bold;
            letter-spacing: 0.7px;
            z-index: 20;
            font-family: var(--font-core);
          }

          /* Glint / swiper effect — unchanged */
          .btn-shine::after {
            background: var(--interactive-accent-primary);
            content: "";
            height: 155px;
            left: -75px;
            opacity: 0.4;
            position: absolute;
            top: -50px;
            transform: rotate(35deg);
            transition: all 550ms cubic-bezier(0.19, 1, 0.22, 1);
            width: 50px;
            z-index: -10;
          }

          .btn-shine:hover::after {
            left: 120%;
            transition: all 550ms cubic-bezier(0.19, 1, 0.22, 1);
          }
        `}} />
        <button
          className={`btn-shine ${className}`}
          onClick={onClick}
          {...props}
        >
          <span className="btn-span">{children}</span>
        </button>
      </>
    );
  } else if (variant === 'social') {
    return (
      <>
        <style dangerouslySetInnerHTML={{__html: `
          /* From Uiverse.io by faxriddin20 */ 

          /* for all social containers*/
          .socialContainer {
            width: 52px;
            height: 52px;
            border-radius: 5px;
            background-color: var(--neutral-subtle);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition-duration: 0.3s;
            cursor: pointer;
            padding: 25px 25px;
            gap: 20px;
            box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.055);
          }
          /* hover color configurable */
          .socialContainer:hover {
            background-color: var(--hover-color);
            transition-duration: 0.3s;
          }

          .socialContainer:active {
            transform: scale(0.9);
            transition-duration: 0.3s;
          }

          .socialSvg {
            width: 17px;
          }

          .socialSvg path {
            fill: rgb(255, 255, 255);
          }

          .socialContainer:hover .socialSvg {
            animation: slide-in-top 0.3s both;
          }

          @keyframes slide-in-top {
            0% {
              transform: translateY(-50px);
              opacity: 0;
            }

            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}} />
        <div className={`socialContainer ${className}`} style={{ '--hover-color': hoverColor }} onClick={onClick} {...props}>
          <div className="socialSvg">{logo}</div>
        </div>
      </>
    );
  } else {
    const getVariantClasses = () => {
      switch (variant) {
        // Add more variants here in the future
        default:
          return `
            cursor-pointer relative group overflow-hidden border-2 px-8 py-2 border-brand
            hover:border-brand transition-colors duration-300
          `;
      }
    };

    const getContent = () => {
      switch (variant) {
        // Add more variant content here in the future
        default:
          return (
            <>
              <span className="font-bold text-on-brand text-xl relative z-10 group-hover:text-brand transition-colors duration-500">
                {children}
              </span>
              <span className="absolute top-0 left-0 w-full bg-interactive-brand-primary transition-transform duration-500 group-hover:-translate-x-full h-full"></span>
              <span className="absolute top-0 left-0 w-full bg-interactive-brand-primary transition-transform duration-500 group-hover:translate-x-full h-full"></span>
              <span className="absolute top-0 left-0 w-full bg-interactive-brand-primary transition-transform duration-500 delay-300 group-hover:-translate-y-full h-full"></span>
              <span className="absolute top-0 left-0 w-full bg-interactive-brand-primary transition-transform duration-500 delay-300 group-hover:translate-y-full h-full"></span>
            </>
          );
      }
    };

    return (
      <button
        className={`${getVariantClasses()} ${className}`}
        onClick={onClick}
        {...props}
      >
        {getContent()}
      </button>
    );
  }
};

export default CustomButton;
