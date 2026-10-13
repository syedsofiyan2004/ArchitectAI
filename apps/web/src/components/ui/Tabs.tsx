import React, { createContext, useContext } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within <Tabs>');
  }
  return context;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  orientation = 'horizontal',
  className = '',
  children,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange, orientation }}>
      <div
        className={`ui-tabs ui-tabs-${orientation} ${className}`.trim()}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  'aria-label'?: string;
  children: React.ReactNode;
}

export const TabList: React.FC<TabListProps> = ({
  children,
  className = '',
  'aria-label': ariaLabel,
  ...rest
}) => {
  const { orientation } = useTabsContext();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={`ui-tab-list ui-tab-list-${orientation} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({
  value,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const { value: activeValue, onValueChange } = useTabsContext();
  const isSelected = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onValueChange(value)}
      className={`ui-tab-trigger ${isSelected ? 'active ui-tab-selected' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon && <span className="ui-tab-icon">{icon}</span>}
      <span className="ui-tab-label">{children}</span>
    </button>
  );
};

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export const TabContent: React.FC<TabContentProps> = ({
  value,
  children,
  className = '',
  ...rest
}) => {
  const { value: activeValue } = useTabsContext();
  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`ui-tab-content ${className}`.trim()}
      tabIndex={0}
      {...rest}
    >
      {children}
    </div>
  );
};
