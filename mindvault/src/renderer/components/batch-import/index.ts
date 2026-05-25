/**
 * 批量导入确认弹窗组件导出
 */

export { BatchImportConfirmModal } from './BatchImportConfirmModal';
export { ImportStatisticsBar } from './ImportStatisticsBar';
export { BatchOperationToolbar } from './BatchOperationToolbar';
export { ImportItemTable } from './ImportItemTable';
export { OperationHistoryBar } from './OperationHistoryBar';
export { FindReplaceModal } from './FindReplaceModal';
export { AddPrefixSuffixModal } from './AddPrefixSuffixModal';
export { ImportResultModal } from './ImportResultModal';

export type {
  TitleOption,
  ImportItemStatus,
  BatchImportItem,
  Operation,
  OperationType,
  BatchImportState,
  ImportStatistics,
  BatchImportConfirmModalProps,
  UploadedFileInfo,
  FindReplaceOptions,
  BatchOperationOptions,
  TableColumn,
  ContextMenuItem,
  ImportResult,
} from './types';

export {
  generateId,
  formatFileSize,
  formatEstimatedTime,
  getFileType,
  getFileTypeIcon,
  calculateStatistics,
  findReplaceText,
  batchFindReplaceTitles,
  batchAddPrefixSuffix,
  createOperation,
  cloneItems,
  validateItems,
  checkSensitiveWords,
  generateThumbnail,
  debounce,
  throttle,
} from './utils';

export { default } from './BatchImportConfirmModal';
