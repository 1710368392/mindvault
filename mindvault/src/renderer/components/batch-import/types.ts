/**
 * 批量导入确认弹窗类型定义
 */

/** 标题选项类型 */
export type TitleOption = 'keep' | 'none' | 'custom';

/** 导入项状态 */
export type ImportItemStatus = 'uploading' | 'processing' | 'completed' | 'failed';

/** 批量导入单项 */
export interface BatchImportItem {
  id: string;                    // 临时唯一ID
  file?: File;                   // 原始文件对象（拖拽/粘贴时使用）
  filePath?: string;             // 文件路径（右键导入时使用）
  fileName: string;              // 原始文件名
  fileSize: number;              // 文件大小
  fileType: string;              // 文件类型
  thumbnailUrl?: string;         // 缩略图URL
  
  // 用户设置
  titleOption: TitleOption;      // 标题选项
  customTitle?: string;          // 自定义标题
  additionalText?: string;       // 附加文本内容
  
  // AI相关
  aiSuggestedTitle?: string;     // AI建议的标题
  aiSuggestedTags?: string[];    // AI建议的标签
  aiExtractedText?: string;      // AI提取的文本内容
  
  // 状态
  status: ImportItemStatus;      // 上传/处理状态
  uploadProgress: number;        // 上传进度 0-100
  errorMessage?: string;         // 错误信息
}

/** 操作类型 */
export type OperationType = 
  | 'batch_keep_title' 
  | 'batch_clear_title' 
  | 'batch_add_prefix'
  | 'batch_add_suffix'
  | 'batch_find_replace'
  | 'batch_apply_text'
  | 'update_item'
  | 'delete_items'
  | 'reorder';

/** 操作记录 */
export interface Operation {
  id: string;
  type: OperationType;
  timestamp: number;
  description: string;
  itemIds?: string[];            // 影响的item ID列表
  prevValues?: Record<string, any>;  // 操作前的值
  nextValues?: Record<string, any>;  // 操作后的值
}

/** 批量导入状态 */
export interface BatchImportState {
  items: BatchImportItem[];
  selectedIds: Set<string>;
  operationHistory: Operation[];
  currentHistoryIndex: number;
}

/** 统计信息 */
export interface ImportStatistics {
  total: number;
  completed: number;
  failed: number;
  totalSize: number;
  byType: Record<string, number>;
  estimatedTime: number;         // 预计处理时间（秒）
}

/** 组件Props */
export interface BatchImportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: BatchImportItem[]) => Promise<void>;
  onCancel?: () => void;
  uploadedFiles: UploadedFileInfo[];
  aiFeatures?: boolean;
  maxHeight?: string | number;
  loading?: boolean;
}

/** 上传文件信息（从上传流程传入） */
export interface UploadedFileInfo {
  id: string;
  file?: File;                    // 文件对象（拖拽/粘贴时使用）
  filePath?: string;              // 文件路径（右键导入时使用）
  fileName: string;               // 文件名
  fileSize: number;               // 文件大小
  fileType: string;               // 文件类型
  thumbnailUrl?: string;
  status: ImportItemStatus;
  uploadProgress: number;
  errorMessage?: string;
  mediaData?: any;               // 上传后的媒体数据
}

/** 查找替换选项 */
export interface FindReplaceOptions {
  find: string;
  replace: string;
  caseSensitive: boolean;
  useRegex: boolean;
}

/** 批量操作选项 */
export interface BatchOperationOptions {
  prefix?: string;
  suffix?: string;
  findReplace?: FindReplaceOptions;
  additionalText?: string;
}

/** 表格列配置 */
export interface TableColumn {
  key: string;
  title: string;
  width?: number | string;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
}

/** 右键菜单项 */
export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

/** 导入结果 */
export interface ImportResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  failedItems: { item: BatchImportItem; reason: string }[];
}
