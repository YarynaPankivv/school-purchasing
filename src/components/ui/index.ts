// Єдина точка входу дизайн-системи: сторінки беруть компоненти лише звідси (`@/components/ui`).
export { Button, buttonVariants, type ButtonProps, type ButtonVariant } from "./button";
export { Checkbox, Input, Switch, Textarea } from "./input";
export { Select } from "./select";
export { BrandMark } from "./brand-mark";
export { Label } from "./label";
export { PasswordInput } from "./password-input";
export { SearchBox } from "./search-box";
export { DateField } from "./date-field";
export { Pagination } from "./pagination";
export { RowKeyNav } from "./row-key-nav";
export {
  DepartmentDetailSkeleton,
  DepartmentsSkeleton,
  HomeSkeleton,
  NewRequestSkeleton,
  PageSkeleton,
  ProfileSkeleton,
  RequestDetailSkeleton,
  RequestsSkeleton,
  Skeleton,
  UserDetailSkeleton,
  UsersSkeleton,
} from "./skeleton";
export { StatusLinks, type StatusLink } from "./status-links";
export { SummaryStrip, type SummaryItem } from "./summary-strip";
export { SubmitButton } from "./submit-button";
export { Icon, type IconName } from "./icons";
export { MobileMenu } from "./mobile-menu";
export { NavLinks, type NavItem } from "./nav-links";
export {
  Alert,
  AppSidebar,
  Avatar,
  Badge,
  type BadgeTone,
  Card,
  DetailList,
  EmptyState,
  Field,
  Forbidden,
  LinkButton,
  PageShell,
  RoleBadge,
  type ShellUser,
} from "./ui";
