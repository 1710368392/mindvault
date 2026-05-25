import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  FileText,
  Image,
  Mic,
  Link as LinkIcon,
  Video,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Zap,
  Search,
  BookOpen,
  Keyboard,
  Calendar,
  Clock,
  MessageSquare,
  PenLine,
  Tags,
  Languages,
  X,
  Bell,
  MapPin,
  Send,
  Play,
  Copy,
  Archive,
  CircleCheck,
  CirclePause,
  CircleCheckBig,
} from 'lucide-react';
import { useCreativityStore } from '../stores/creativityStore';
import { showAIContextMenu } from '../components/ai/AIContextMenu';
import { useUIStore } from '../stores/uiStore';
import { useAIStore } from '../stores/aiStore';
import ShootingStar from '../components/common/ShootingStar';
import { useBoardStore } from '../stores/boardStore';
import { formatRelativeTime, getCreativityTypeLabel } from '../utils/formatters';
import CardPreview from '../components/card/CardPreview';
import CardEditor from '../components/card/CardEditor';
import FlipDigit from '../components/common/FlipDigit';
import FavoriteBadge from '../components/common/FavoriteBadge';
import CollectionIcon from '../components/common/CollectionIcon';
import Spinner from '../components/common/Spinner';
import BoardIcon from '../components/common/BoardIcon';
import FlashbackVideoPlayer from '../components/common/FlashbackVideoPlayer';
import WeatherIcon from '../components/common/WeatherIcon';
import WeatherSplashIcon from '../components/common/WeatherSplashIcon';
import CitySelector from '../components/common/CitySelector';
import WeatherBriefing from '../components/common/WeatherBriefing';
import WeatherNotification from '../components/common/WeatherNotification';
import WeatherDetailPanel from '../components/weather/WeatherDetailPanel';
import WeatherBackground from '../components/weather/WeatherBackground';
import { useNotificationStore } from '../stores/notificationStore';
import StatsDashboard from '../components/dashboard/StatsDashboard';
import { 
  fetchWeatherForecast, 
  generateDailyBriefing,
  shouldShowBriefing,
  markBriefingShown,
  getUserPreference,
  saveUserPreference,
  type DailyBriefing as DailyBriefingType,
  type WeatherAlert,
  type WeatherForecast
} from '../utils/weatherAlert';
import { api } from '../utils/api';
import { toMediaUrl, isPureMediaContent } from '../utils/media';
import { fetchWeather, getCurrentCity, getWeatherPrivacy, refreshWeather, clearWeatherCache, type City, type WeatherMode } from '../utils/weather';
import { useWeather } from '../contexts/WeatherContext';
import { useWeatherStore } from '../stores/weatherStore';
import type { Creativity } from '@shared/types';
import { Card } from '../components/ant-design';
import { Popover, Skeleton, Image as AntImage, Menu, Button } from 'antd';
import { PuzzleNavIcon, PuzzleBoardIcon } from '../components/layout/Sidebar';
import { useTheme } from '../hooks/useTheme';
import { useVideoThumbnailWithPath, useImageThumbnail } from '../hooks/useVideoThumbnail';

const DesignProcessMousePenIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none">
      <path fill="currentColor" fillOpacity="0.85" d="M21.802.784a3 3 0 0 0-2.89-.56c-.34.16-.68.71.08 1.05a.69.69 0 0 1 .47.42a1.48 1.48 0 0 1-.15.9a7.6 7.6 0 0 1-.93 1.3a2.7 2.7 0 0 0-.38.78a2.32 2.32 0 0 0 .21 2a2.73 2.73 0 0 0 1.66 1.1l1.52.22a20 20 0 0 1-.4 3.169a12.6 12.6 0 0 1-1.07 3.1a3.8 3.8 0 0 1-.62.999a.39.39 0 0 1-.53.09a1.1 1.1 0 0 1-.42-.66a2.8 2.8 0 0 1-.1-1c.047-.738.174-1.469.38-2.18c.3-1.12.72-2.25 1-3.289a.32.32 0 0 0-.2-.41a.33.33 0 0 0-.41.21c-.37 1-.85 2.14-1.22 3.25c-.27.757-.457 1.542-.56 2.34a3.6 3.6 0 0 0 .16 1.62a2 2 0 0 0 .74.999a1.27 1.27 0 0 0 1.61 0a3.37 3.37 0 0 0 1.11-1.51c.376-.877.654-1.792.83-2.73a19.6 19.6 0 0 0 .3-4.149a3.08 3.08 0 0 0 1.45-1.26a4.14 4.14 0 0 0 .55-2.34a5.23 5.23 0 0 0-2.19-3.459m1 5.42a4.2 4.2 0 0 1-1.31 1.16l-1.5-.31a1.93 1.93 0 0 1-1.05-.81a1.52 1.52 0 0 1-.09-1.25a2 2 0 0 1 .29-.52a8 8 0 0 0 1.11-1.48a2.23 2.23 0 0 0 .18-1.77c.447.186.86.446 1.22.77a4 4 0 0 1 1.49 2.3a3.3 3.3 0 0 1-.33 1.91z"/>
      <path fill="currentColor" fillOpacity="0.95" d="M18.172 17.382a2.33 2.33 0 0 1-1 1.15c-.39.18-.86.06-1.4-.44a7 7 0 0 1-.45-.47a6 6 0 0 1-.39-.52a12.9 12.9 0 0 1-1.619-4.65a18.5 18.5 0 0 0-1-3.37a6.86 6.86 0 0 0-2.48-2.999a7.7 7.7 0 0 0-2.59-1.09a6 6 0 0 0-2.819.08a3.75 3.75 0 0 0-2.43 2.08a3.54 3.54 0 0 0-.21 2.12c.11.47.29.5.59-.25a2.85 2.85 0 0 1 .22-1.59a2.93 2.93 0 0 1 2-1.58a5.16 5.16 0 0 1 2.41 0a6.8 6.8 0 0 1 2.21 1a5.86 5.86 0 0 1 2.08 2.59a18.6 18.6 0 0 1 1 3.18a13.6 13.6 0 0 0 1.939 4.909a6.5 6.5 0 0 0 1 1.1a2 2 0 0 0 2.28.5a3.2 3.2 0 0 0 1.31-1.67c.22-.61-.46-.65-.65-.08"/>
      <path fill="currentColor" fillOpacity="0.85" d="M6.694 10.703a4.83 4.83 0 0 0-3.41-1.09a3.6 3.6 0 0 0-.65.14a3.24 3.24 0 0 0-2.229 2.1a8.9 8.9 0 0 0 .2 5.879a12.4 12.4 0 0 0 3.13 4.899a4.62 4.62 0 0 0 4.059 1.22c2.56-.52 4.48-3.55 2.85-7.66a14.8 14.8 0 0 0-3.95-5.488m-5.28 1.52a2.36 2.36 0 0 1 .91-1.18q.017.354.09.7q.073.311.19.61q.112.295.27.57q.363.638.8 1.23a.32.32 0 1 0 .56-.31c-.16-.42-.29-.87-.43-1.32c-.06-.19-.12-.37-.19-.56s-.14-.36-.22-.54s-.22-.47-.32-.71l.32-.06c.966-.087 1.929.2 2.69.8q.838.663 1.54 1.47c-.79.47-1.65 1-2.54 1.41c-.42.22-.84.44-1.26.639l-.83.39a9.3 9.3 0 0 1-1.77.63a7 7 0 0 1 .19-3.77m6.25 10.938a3.85 3.85 0 0 1-3.34-1.17a11.8 11.8 0 0 1-2.72-4.6a8 8 0 0 1-.23-.79a8.7 8.7 0 0 0 2.79-.61c.66-.273 1.293-.607 1.89-.999q1.039-.697 2-1.5a13.2 13.2 0 0 1 1.84 3c2.43 5.499-2.13 6.649-2.23 6.669"/>
    </g>
  </svg>
);

const DnxcIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none">
      <path fill="var(--text-primary)" d="M18.287 11.684a7.7 7.7 0 0 0-1.305-3.748a6.7 6.7 0 0 0-7.286-2.72a6.87 6.87 0 0 0-5.262 5.65a5.6 5.6 0 0 0 0 1.585c.076.547.278 1.068.588 1.525c.548.777 1.395.997 1.824 1.604c.166.235.24.522.209.808a.27.27 0 0 0 .249.289h.28q1.071.296 2.172.448q.471.06.947.06h.946c.728 0 1.446-.14 2.183-.24a.309.309 0 1 0-.03-.617l-2.153-.12H7.603c0-.33-.1-.654-.289-.926c-.409-.589-1.236-.858-1.754-1.635a3 3 0 0 1-.409-1.256a4.8 4.8 0 0 1 .02-1.405a6.05 6.05 0 0 1 4.754-4.814a5.74 5.74 0 0 1 6.2 2.352a6.7 6.7 0 0 1 1.136 3.22a3.92 3.92 0 0 1-.997 3.069a6 6 0 0 1-.478.429c-.449.348-.897.628-1.336.996c-.162.161-.282.36-.349.578a8 8 0 0 0-.219.997c-.01.23-.086.45-.22.638a3.2 3.2 0 0 1-2.232.767a10.2 10.2 0 0 1-3.628-.787c.09-.16 0-.648 0-.947a.32.32 0 0 0-.329-.299a.31.31 0 0 0-.289.329c0 .399-.07.907 0 1.126a.43.43 0 0 0 .25.31c1.278.59 2.66.928 4.066.996a3.93 3.93 0 0 0 2.79-.917c.16-.155.28-.347.35-.558a7 7 0 0 0 .239-.997c-.005-.176.033-.35.11-.508c.438-.379.876-.628 1.315-.997q.31-.229.578-.508a4.84 4.84 0 0 0 1.405-3.777"/>
      <path fill="var(--primary-color)" d="M9.696 13.976c.06-.578.1-1.166.15-1.744q.234.242.528.408c.318.202.69.302 1.067.29c.35-.01.692-.106.996-.28v.827q-.005.974.16 1.934c0 .21.498.339.598 0q-.091-.967 0-1.933q.208-1.316.588-2.592a.44.44 0 0 0-.2-.518a.45.45 0 0 0-.608.06a.7.7 0 0 0-.1.16l-.109.218l-.24.39a1.6 1.6 0 0 1-.508.457a1.14 1.14 0 0 1-.597.18a1 1 0 0 1-.628-.23a1.75 1.75 0 0 1-.519-.597l-.179-.449c0-.09-.07-.309-.09-.369a.5.5 0 0 0-.398-.199a.46.46 0 0 0-.449.13c-.319.339-.07 2.252-.21 4.475q.038.323 0 .648c0 .418.47.538.579.1c.106-.448.163-.906.17-1.366M3.098 6.182a3 3 0 0 0-.408-.409l-.459-.339c-.369-.239-.757-.428-1.146-.647a.32.32 0 0 0-.439.07a.31.31 0 0 0 .07.428c.3.309.588.618.897.917c.13.13.26.259.389.369c.13.11.27.229.409.338q.518.353.996.758a.27.27 0 0 0 .379 0a.27.27 0 0 0 .05-.389a5.8 5.8 0 0 0-.738-1.096m3.967-4.445q.075.276.19.538c.07.17.139.339.228.508c.21.389.459.738.678 1.136a.28.28 0 0 0 .518-.189a12 12 0 0 0-.269-1.326c-.05-.179-.12-.358-.189-.538a4 4 0 0 0-.21-.508C7.754.959 7.514.6 7.285.212a.31.31 0 0 0-.409-.19a.31.31 0 0 0-.169.4c.12.468.22.896.359 1.315m7.444 2.621a.27.27 0 0 0 .299-.24q.21-.543.369-1.106c.05-.219.07-.448.1-.667a6 6 0 0 1 .109-.997a.328.328 0 0 0-.568-.329a4.3 4.3 0 0 0-.508.997q-.075.225-.12.458q-.015.235 0 .469c0 .378.08.717.11 1.056c-.044.157.05.32.209.359m8.572 3.139c-.469 0-.907-.07-1.366-.07h-.588c-.19 0-.389.07-.578.12q-.669.226-1.286.568a.279.279 0 1 0 .18.519c.448-.07.867-.07 1.295-.1l.538-.06l.549-.1c.428-.09.847-.199 1.295-.289a.33.33 0 0 0 .29-.338a.31.31 0 0 0-.33-.25"/>
      <path fill="var(--text-primary)" d="M12.915 21.002q-.497.031-.996 0c-.32 0-.638-.05-.997-.07l-.997-.05c-.657 0-1.305 0-1.993-.07a.28.28 0 0 0-.329.21a.28.28 0 0 0 .21.33a10.4 10.4 0 0 0 1.724.517q.385.07.777.08q.39.03.777 0q.967-.079 1.904-.329a.32.32 0 0 0 .26-.359a.31.31 0 0 0-.34-.259m-1.075 2.014a8 8 0 0 1-.997-.09a5 5 0 0 0-.658 0c-.399 0-.768.1-1.156.14a.27.27 0 0 0-.3.239a.3.3 0 0 0 .25.309q.504.192 1.026.328q.223.04.449.05q.229.015.458 0A4.2 4.2 0 0 0 12 23.624a.31.31 0 0 0-.13-.608z"/>
    </g>
  </svg>
);

const Icon111: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="currentColor" fillOpacity="0.9" d="M16 12.038c0-.39-.26-.53-.37-.73c-.24-.46-.77-.89-.62-1.24c.24-.53 1-.64 1.57-.5q.6.278 1.23.48c.37.06.66-.31 1-.72a5.2 5.2 0 0 0 1.06-1.81a.56.56 0 0 0-.08-.33a9.4 9.4 0 0 0-2.09-1.65s-.14-.14-.24-.21a3.6 3.6 0 0 0 .42-1.74a2.38 2.38 0 0 0-4-1.48c-.51.57.34.87.41.38l.32-.25a1.76 1.76 0 0 1 2.59 1.66a3.9 3.9 0 0 1-.48 1.29c-.39.8.49.66 2.3 2.36a6 6 0 0 1-1.17 1.51l-1-.42a2.31 2.31 0 0 0-2.76 1c-.46 1 .28 1.53.62 2.18c.22.44.35.14 0 .82a7.2 7.2 0 0 1-1 1.48c-1-.32-6.5-3.23-7.16-4.34a5.6 5.6 0 0 1 1-2c1.13.6 1.81 1.11 2.84.52c2.1-1.22 1.42-3.62-.95-4a8.6 8.6 0 0 1 1-1.72c.25-.27 1.26.23 1.56.38a.324.324 0 1 0 .29-.58c-2.23-1.2-2.29-.56-3.52 1.6c-.16.28-.36.59-.13.87s.92.21 1.18.3c.7.25 1.28.94.92 1.59c-.24.42-.83.94-1.32.87c-2-.85-1.89-1.5-2.8-.17a4.86 4.86 0 0 0-1 2.37c0 1.79 7.75 5.39 8.25 5.41c.88.05 2.13-2.62 2.13-3.18"/>
      <path fill="currentColor" fillOpacity="0.7" d="M8.71 19.548c-.32-1.39.26-5.08-1.38-5.05c-1.46 0-1.18 1.19-1.7 2.6c-.14.39-.12.43-1-.38a3.5 3.5 0 0 1-.45-.56c.08-.39-.08-.1.22-2.6c.11-.89.07-1.93-.72-2.35a1.3 1.3 0 0 0-1.55.22a1.09 1.09 0 0 0-1.07-.45C0 11.098 0 12.318 0 13.348c.06 2.74 2.2 5.68 4.24 7.51l.62 1.58c.09.27.67-.05.57-.32L5 20.448c0-.13-4.23-3.48-4.19-7.11c0-.41 0-1.52.38-1.56c.58-.06.47.46 1.27 2.55a12.5 12.5 0 0 0 1.09 2.25a4.34 4.34 0 0 0 1.78 1.5c1.25.23 1.08-1.82 1.46-2.4c.09-.15.26-.22.54-.23c1 0 .22 4.36.88 4.65c.23.11.69-.21.54-.41c.02-.02-.03-.08-.04-.14m-6.3-7.65a.71.71 0 0 1 .95-.1c.4.27.31 1.25.27 1.8a7 7 0 0 0 .05 1.61a33 33 0 0 1-1.27-3.31m12.84 7.79c-.15.2.31.52.54.41c.66-.29-.09-4.69.88-4.65c.28 0 .45.08.54.23c.38.58.21 2.63 1.46 2.4a4.34 4.34 0 0 0 1.78-1.5c.452-.71.83-1.463 1.13-2.25c.8-2.09.69-2.61 1.27-2.55c.41 0 .38 1.15.38 1.56c0 3.63-4.14 7-4.19 7.11l-.47 1.67c-.1.27.48.59.57.32l.62-1.58c2-1.83 4.18-4.77 4.24-7.51c0-1 0-2.25-1.06-2.37a1.09 1.09 0 0 0-1.1.45a1.3 1.3 0 0 0-1.55-.22c-.79.42-.83 1.46-.72 2.35c.3 2.5.14 2.21.22 2.6a3.5 3.5 0 0 1-.45.56c-.88.81-.86.77-1 .38c-.52-1.41-.24-2.6-1.7-2.6c-1.64 0-1.06 3.66-1.38 5.05c0 .06-.06.12-.04.14m6.3-7.65a33 33 0 0 1-1.27 3.31a7 7 0 0 0 .05-1.61c0-.55-.13-1.53.27-1.8a.71.71 0 0 1 .95.1"/>
    </g>
  </svg>
);

const StreamlineJigsawIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="currentColor" fillOpacity="0.9" d="m22.252 12.657l-.25-.6a.53.53 0 0 0-.539-.309c-.32.05-.649.17-.999.2a.42.42 0 0 1-.379-.22a.44.44 0 0 1 0-.439q.2-.368.51-.649c.08-.08.309-.27.439-.42a.74.74 0 0 0 .2-.459a.84.84 0 0 0-.05-.36c0-.129-.17-.309-.19-.389l-.59-1.208a5 5 0 0 0-.329-.56a.7.7 0 0 0-.4-.259a.9.9 0 0 0-.389 0c-.12 0-.3.15-.37.18l-.928.44c-.09-.1-.18-.18-.2-.2a1.9 1.9 0 0 0-.798-.51a2.2 2.2 0 0 0-.92-.09c-.53.058-1.016.32-1.357.73a1.9 1.9 0 0 0-.45 1.447a2.2 2.2 0 0 0 .19.61l-.38.16l-.598.289c-.52.45-.3.928.26.709l.628-.25c.18-.06.42-.1.63-.17q.184-.063.349-.17a.51.51 0 0 0 .12-.608c0-.06-.11-.21-.11-.22l-.12-.44a1 1 0 0 1 .26-.679a1 1 0 0 1 .669-.23a1 1 0 0 1 .42.08a.8.8 0 0 1 .299.22s.21.36.29.48a.72.72 0 0 0 .588.35a.9.9 0 0 0 .34-.13l.32-.19l.888-.35l.55 1.079l.05.15l-.17.12c-.36.378-.618.842-.75 1.347a1.45 1.45 0 0 0 .3 1.229a1.39 1.39 0 0 0 1.059.599c.317-.014.63-.074.928-.18c.08.12.19.24.19.25c.2.389.43.778.63 1.168c.05.11.089.23.139.34c-.19.09-.37.189-.57.269c-.409.17-.838.27-1.257.41c-.42.14-.86.339-1.268.509l-1.518.928l-.999.49a.45.45 0 0 0 .37.818c.9-.27 1.782-.603 2.636-.998c.29-.12.589-.23.879-.37c.289-.14.599-.3.878-.459a10 10 0 0 0 .859-.62l-.06 1.11c0 .678 0 .868-.849 1.467q-.93.565-1.927.999c-.56.3-1.158.559-1.747.809c-.31.14-.64.27-.999.399c0-.25.09-1.288-.36-1.288s-.778.25-.649 1.078c.05.33.1.22.21.54l-2.496.998c-.919.39-1.768.859-2.676 1.228q-.555.23-1.139.38a.384.384 0 0 0 .17.749a9 9 0 0 0 1.278-.37c.939-.3 1.828-.699 2.756-.998c1.259-.44 2.547-.82 3.775-1.309a20.5 20.5 0 0 0 2.456-1.188a15 15 0 0 0 1.997-1.258a3.6 3.6 0 0 0 .999-1.328a.7.7 0 0 0 .08-.34c0-.22-.1-.529-.11-.679c-.07-3.035.769-.479-.7-3.864"/>
      <path fill="currentColor" fillOpacity="0.7" d="M8.432 23.142a3 3 0 0 1-1.348-1.178a20 20 0 0 1-1.338-2.786c-.24-.52-.46-1.049-.68-1.578c-.359-.799-1.477-3.625-1.507-3.715c-.28-.689-.609-1.368-.879-2.057c-.11-.28-.22-.559-.32-.849c-.099-.29-.249-.818-.349-1.238a7 7 0 0 1-.18-.759a1.3 1.3 0 0 1 .33-1.258c.18-.25.38-.48.58-.709q.141 1.235.419 2.447c.2.888.529 1.577.799 2.476c.1.32.13.48.31.949a.55.55 0 0 0 .998-.36c-.15-.39-.19-.519-.31-.809A36 36 0 0 1 3.86 8.723c-.18-.74-.36-1.428-.5-2.137c0 0 0-.06-.06-.1c1.209-.44 2.407-.999 3.625-1.428a13 13 0 0 1 1.648-.5q.553-.27 1.148-.429c.1.19.25.46.37.74q.172.357.24.748c0 .12 0 0 0 0a1.7 1.7 0 0 1-.24.32a3.1 3.1 0 0 0-.56.819a1.35 1.35 0 0 0 0 1.098c.139.398.392.746.73.999a1.68 1.68 0 0 0 1.238.29h.19a.3.3 0 0 0 0 .099l.329.829c.3.519.859.05.769-.37l-.25-.779a6 6 0 0 0-.22-.639a.51.51 0 0 0-.399-.3a.65.65 0 0 0-.29 0c-.08 0-.37.07-.36.17a.65.65 0 0 1-.369-.17a1.1 1.1 0 0 1-.3-.478a.3.3 0 0 1 0-.25q.224-.327.52-.59c.218-.23.376-.511.46-.818a2 2 0 0 0-.15-.999a9.5 9.5 0 0 0-.72-1.507a.79.79 0 0 0-.788-.35q-.856.16-1.688.42a13 13 0 0 0-1.717.698c-1.268.57-2.507 1.289-3.735 1.878l-.22.15c-.329.339-.688.689-.999 1.068q-.34.399-.61.849a.9.9 0 0 0-.079.33c0 .219.05.538.05.668c0 .31.06.61.12.919s.16.869.25 1.308q.15.662.389 1.298c.22.6.47 1.198.699 1.797c.43 1.089.849 2.177 1.318 3.246c.33.719.689 1.428 1.068 2.117c.455.98.99 1.922 1.598 2.816a3.74 3.74 0 0 0 1.887 1.368a.36.36 0 0 0 .39-.14a.35.35 0 0 0 .21.1a.37.37 0 0 0 .399-.36q.168-.675.23-1.368c-.27-.52-.56-.689-.999-.31c-.103.426-.12.867-.05 1.299"/>
      <path fill="currentColor" fillOpacity="0.6" d="m11.608 1.743l.279.36c.1.11.2.22.31.319c.998.998.998.998 1.258.909c.45-.22-.2-1.518-.28-1.658a2 2 0 0 0-.33-.44a2.3 2.3 0 0 0-.399-.359C11.138-.124 10.91.215 10.82.355s-.04.36.789 1.388m3.913 1.248c.11 0 .32.11.838-.998q.081-.158.12-.33c0-.11 0-.22.06-.33c.1-1.058.14-1.198-.13-1.318c-.11 0-.429-.22-.998.999a1.4 1.4 0 0 0-.14.36q-.057.18-.07.369s-.05 1.248.32 1.248m3.694.999c.15-.07.29-.15.43-.23l.429-.27c1.168-.769 1.398-.818 1.268-1.178c-.06-.15-.15-.47-1.797.08a4 4 0 0 0-.54.24a3.3 3.3 0 0 0-.489.34c-.24.219-1.208 1.237-.848 1.577c.359.34.23.13 1.547-.56M15.991 17.21l-.57-1.478c.17-.1.36-.18.37-.19a2.7 2.7 0 0 0 .77-1.058a1.8 1.8 0 0 0 .089-.998a1.5 1.5 0 0 0-.659-.999a2.28 2.28 0 0 0-1.488-.35l-.579.12l-.13-.16l-.629-1.118s-.18-.569-.35-.619c-.479-.14-1.387.71-1.767.939q-.222.135-.46.24c-.089 0-.498.15-.658.23a.58.58 0 0 0-.25.289a.7.7 0 0 0 0 .27c0 .15.13.449.13.569c.016.253-.029.506-.13.739a.86.86 0 0 1-.4.439a.41.41 0 0 1-.399 0a2 2 0 0 1-.569-.48q-.23-.285-.5-.539a1 1 0 0 0-.568-.21a2 2 0 0 0-.42.07c-.36.08-.729.27-1.068.31h-.13c-.32-.13-1.178.45-1.058.789c0 .07.998 2.377 1.348 3.195c.26.65.519 1.288.799 1.918q.286.727.718 1.378q.271.332.63.569a3 3 0 0 0 2.566.13a13.6 13.6 0 0 0 1.997-.72q.93-.451 1.807-.998c.25-.15.72-.34 1.079-.57c0 .08.689-.409.749-.648a1.8 1.8 0 0 0-.27-1.059m-.929-2.516s-.449.3-.599.42a.64.64 0 0 0-.25.668l.58 1.788l.1.18l-.2.11c-.34.19-.759.359-.999.489c-.549.33-1.108.639-1.697.918a13 13 0 0 1-1.768.69c-.293.1-.599.164-.908.19a1.6 1.6 0 0 1-.78-.13a1.1 1.1 0 0 1-.399-.37a8 8 0 0 1-.579-.999a48 48 0 0 1-1.128-2.276c-.36-.77-.55-1.239-.819-1.868h.21c1.837-.479 1.158-.37 1.528 0c.33.366.75.641 1.218.8a1.48 1.48 0 0 0 1.188-.13a1.82 1.82 0 0 0 .759-.82c.22-.455.303-.965.24-1.467a.7.7 0 0 0-.13-.25c.14-.07.29-.19.33-.21q.278-.15.539-.33c.31-.219.609-.468.928-.688l.6 1.188q.085.259.229.49a.53.53 0 0 0 .31.19q.204.03.409 0c.2 0 .43-.1.61-.11c.246-.015.491.04.708.159a.59.59 0 0 1 .33.41a.82.82 0 0 1-.11.519q-.186.253-.44.439z"/>
    </g>
  </svg>
);

const HOME_TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  text: FileText, image: Image, audio: Mic, link: LinkIcon, video: Video, document: FileText,
};

const FLASHBACK_MEDIA_MAX_HEIGHT_BASE = 450;

function getFlashbackMaxHeight(isLandscape: boolean) {
  return isLandscape
    ? Math.round(FLASHBACK_MEDIA_MAX_HEIGHT_BASE * 0.7)
    : Math.round(FLASHBACK_MEDIA_MAX_HEIGHT_BASE * 0.9);
}

const HomeThumbnail: React.FC<{
  type: string;
  content: string;
  mediaFilePath?: string;
  thumbnailPath?: string;
  size: number;
  iconSize?: number;
  iconColor?: string;
  bg?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ type, content, mediaFilePath, thumbnailPath, size, iconSize = 14, iconColor = 'var(--text-secondary)', bg = 'var(--bg-tertiary)', style, onClick }) => {
  const [thumbError, setThumbError] = useState(false);
  const resolvedContent = mediaFilePath || content;
  const videoThumb = useVideoThumbnailWithPath(type, resolvedContent, thumbnailPath);
  const imageThumb = useImageThumbnail(resolvedContent, thumbnailPath);

  if (type === 'video' && videoThumb) {
    return (
      <div className="keycap-hover-anim" onClick={onClick} style={{
        width: size, height: size, overflow: 'hidden', flexShrink: 0,
        cursor: onClick ? 'pointer' : undefined,
        position: 'relative',
        ...style,
      }}>
        <img
          src={videoThumb}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setThumbError(true)}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            display: 'block', 
            pointerEvents: 'none',
            imageRendering: 'high-quality'
          }}
        />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Play size={8} style={{ color: 'white', marginLeft: 0.5 }} />
        </div>
      </div>
    );
  }

  const isImageType = type === 'image';
  // 对于小尺寸显示，优先使用缩略图以节省带宽和内存
  let thumbUrl = '';
  if (isImageType && !thumbError) {
    thumbUrl = imageThumb || toMediaUrl(resolvedContent);
  }

  if (thumbUrl) {
    return (
      <div className="keycap-hover-anim" onClick={onClick} style={{
        width: size, height: size, overflow: 'hidden', flexShrink: 0,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}>
        <img
          src={thumbUrl}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setThumbError(true)}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            display: 'block', 
            pointerEvents: 'none',
            imageRendering: 'high-quality'
          }}
        />
      </div>
    );
  }

  const IconComponent = HOME_TYPE_ICONS[type] || FileText;
  return (
    <div className="keycap-hover-anim" onClick={onClick} style={{
      width: size, height: size, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      cursor: onClick ? 'pointer' : undefined,
      ...style,
    }}>
      <IconComponent size={iconSize} color={iconColor} />
    </div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const {
    creativities, stats, isLoading,
    fetchCreativities, fetchStats, getRandomCreativity,
    updateCreativity,
  } = useCreativityStore();
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const prevCountRef = useRef(0);
  const toggleQuickCapture = useUIStore((s) => s.toggleQuickCapture);
  const setSearchDialogOpen = useUIStore((s) => s.setSearchDialogOpen);
  const startDrag = useUIStore((s) => s.startDrag);
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const justDraggedRef = useRef(false);

  // 右键菜单
  const [contextMenuBoard, setContextMenuBoard] = useState<any>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [statusSubmenuOpen, setStatusSubmenuOpen] = useState(false);
  const boardContextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (boardContextMenuRef.current && !boardContextMenuRef.current.contains(e.target as Node)) {
        setContextMenuBoard(null);
        setStatusSubmenuOpen(false);
      }
    };
    if (contextMenuBoard) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [contextMenuBoard]);

  const handleBoardContextMenu = useCallback((e: React.MouseEvent, board: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuBoard(board);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setStatusSubmenuOpen(false);
  }, []);

  const handleBoardMenuAction = useCallback(async (action: string) => {
    if (!contextMenuBoard) return;
    const boardId = contextMenuBoard.id;
    setContextMenuBoard(null);
    setStatusSubmenuOpen(false);

    if (action === 'duplicate') {
      try {
        await api.board.duplicate(boardId);
        await fetchBoards();
      } catch (err) { console.error('复制失败:', err); }
    } else if (action === 'change-icon') {
      // 触发文件选择器
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          try {
            const iconPath = await api.board.uploadIcon(boardId, imageData);
            await api.board.updateIcon(boardId, iconPath);
            await fetchBoards();
          } catch (err) { console.error('更换图标失败:', err); }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else if (action.startsWith('status:')) {
      const status = action.replace('status:', '');
      try {
        await api.board.update(boardId, { project_status: status });
        await fetchBoards();
      } catch (err) { console.error('更新状态失败:', err); }
    } else if (action === 'delete') {
      try {
        await api.board.delete(boardId);
        await fetchBoards();
      } catch (err) { console.error('删除失败:', err); }
    }
  }, [contextMenuBoard, fetchBoards]);

  const handleItemDragStart = useCallback((e: React.MouseEvent, item: Creativity) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(
      { id: item.id, title: item.title, type: item.type },
      { x: e.clientX, y: e.clientY }
    );
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 300);
  }, [startDrag]);

  // 实时时间状态
  const [currentTime, setCurrentTime] = useState(new Date());

  // 从 Context 获取天气数据（应用级别管理，只在启动时加载一次）
  const { weather, weatherLoading, currentCity, weatherMode, refreshWeatherData, updateWeatherMode, updateCurrentCity, updateWeather } = useWeather();
  const locationFailed = useWeatherStore((s) => s.locationFailed);
  const dismissLocationFail = useWeatherStore((s) => s.dismissLocationFail);
  const unreadAlertCount = useWeatherStore((s) => s.unreadAlertCount);
  const [citySelectorVisible, setCitySelectorVisible] = useState(false);
  const [weatherDetailVisible, setWeatherDetailVisible] = useState(false);

  // 根据隐私设置计算显示的城市名
  const displayCityName = useMemo(() => {
    if (!weather) return '当前位置';
    if (weatherMode === 'manual' && weather.cityName) {
      return weather.cityName;
    }
    // 自动定位模式下，根据隐私设置决定是否显示地区名
    const privacy = getWeatherPrivacy();
    if (privacy.showLocationName && weather.cityName) {
      return weather.cityName;
    }
    return '当前位置';
  }, [weatherMode, weather?.cityName]);

  // 天气播报和预警状态
  const [briefingVisible, setBriefingVisible] = useState(false);
  const [briefingData, setBriefingData] = useState<DailyBriefingType | null>(null);
  const [briefingMode, setBriefingMode] = useState<'morning' | 'evening' | 'alert'>('morning');
  const [activeAlerts, setActiveAlerts] = useState<WeatherAlert[]>([]);
  const [alertPopupVisible, setAlertPopupVisible] = useState(false);

  // 天气通知状态（新的简洁通知）
  const [forecastNotification, setForecastNotification] = useState<{
    visible: boolean;
    forecast: WeatherForecast | null;
    notificationId: string | null;
  }>({ visible: false, forecast: null, notificationId: null });
  const [alertNotification, setAlertNotification] = useState<{
    visible: boolean;
    alert: WeatherAlert | null;
    notificationId: string | null;
  }>({ visible: false, alert: null, notificationId: null });

  const [flashbacks, setFlashbacks] = useState<Creativity[]>([]);
  const [flashbackLoading, setFlashbackLoading] = useState(false);
  const [flashbackImgErrors, setFlashbackImgErrors] = useState<Record<string, boolean>>({});
  const [flashbackMediaSizes, setFlashbackMediaSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [activeFlashbackIndex, setActiveFlashbackIndex] = useState(0);
  const activeFlashbackIndexRef = useRef(0);
  const flashbackMediaRefs = useRef<Record<string, HTMLVideoElement | HTMLAudioElement | null>>({});
  const flashbackAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashbackUserPausedRef = useRef<Record<string, boolean>>({});
  const flashbackProgrammaticPauseRef = useRef<Record<string, boolean>>({});
  const flashbackPlayingState = useRef<Record<string, { playing: boolean; currentTime: number }>>({});
  const goToNextFlashbackRef = useRef<() => void>(() => {});
  const scheduleFlashbackSwitchRef = useRef<(overrideIndex?: number) => void>(() => {});
  const flashbackVolumeRef = useRef<{ volume: number; muted: boolean }>(
    (() => {
      try {
        const stored = localStorage.getItem('mindvault:flashback:volume');
        if (stored) return JSON.parse(stored);
      } catch {}
      return { volume: 1, muted: true };
    })()
  );
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [flashbackHeight, setFlashbackHeight] = useState<number | undefined>(undefined);
  const flashbackCardRef = useRef<HTMLDivElement>(null);
  const [isHoveringFlashback, setIsHoveringFlashback] = useState(false);
  const [previewItem, setPreviewItem] = useState<Creativity | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [directImagePreview, setDirectImagePreview] = useState<Creativity | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Creativity } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const homeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = homeContainerRef.current;
    if (!container) return;

    const getKeycap = (target: EventTarget | null): Element | null => {
      if (!target || !(target instanceof HTMLElement)) return null;
      return target.closest('.keycap-hover-anim');
    };

    const handleMouseOver = (e: MouseEvent) => {
      const el = getKeycap(e.target);
      if (!el) return;
      if (el.getAttribute('data-hover-state') === 'pressing') return;
      el.setAttribute('data-hover-state', 'pressing');
      el.classList.remove('keycap-hover-release');
      void el.offsetWidth;
      el.classList.add('keycap-hover-press');
    };

    const handleMouseOut = (e: MouseEvent) => {
      const el = getKeycap(e.target);
      if (!el) return;
      if (el.contains(e.relatedTarget as HTMLElement)) return;
      el.setAttribute('data-hover-state', 'releasing');
      el.classList.remove('keycap-hover-press');
      void el.offsetWidth;
      el.classList.add('keycap-hover-release');
      const onEnd = () => {
        el.classList.remove('keycap-hover-release');
        el.removeAttribute('data-hover-state');
        el.removeEventListener('animationend', onEnd);
      };
      el.addEventListener('animationend', onEnd);
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  // 时间更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 天气播报和预警检查
  useEffect(() => {
    const checkForecastNotification = async () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour >= 20 && hour < 23 && shouldShowBriefing('evening')) {
        const forecast = await fetchWeatherForecast();
        if (forecast && forecast.length > 1) {
          const tomorrow = forecast[1];
          const notificationId = useNotificationStore.getState().addNotification({
            category: 'weather',
            level: 'info',
            title: `明日${tomorrow.weatherLabel || '天气预报'}`,
            message: `${tomorrow.minTemp}°~${tomorrow.maxTemp}°，降水概率 ${tomorrow.precipitationProbability}%`,
          });
          setForecastNotification({
            visible: true,
            forecast: tomorrow,
            notificationId,
          });
          markBriefingShown('evening');
        }
      }
    };

    const checkAlertsFromStore = async () => {
      const newAlerts = await useWeatherStore.getState().checkAlerts();
      if (newAlerts.length > 0) {
        setActiveAlerts(useWeatherStore.getState().alerts);
        const sortedAlerts = [...newAlerts].sort((a, b) => {
          const priority = { extreme: 4, high: 3, medium: 2, low: 1 };
          return priority[b.level] - priority[a.level];
        });
        const notificationId = useNotificationStore.getState().addNotification({
          category: 'weather',
          level: sortedAlerts[0].level === 'extreme' || sortedAlerts[0].level === 'high' ? 'error' : 'warning',
          title: sortedAlerts[0].title,
          message: sortedAlerts[0].message,
          extra: { weatherLevel: sortedAlerts[0].level },
        });
        setAlertNotification({
          visible: true,
          alert: sortedAlerts[0],
          notificationId,
        });
      }
    };

    checkForecastNotification();
    checkAlertsFromStore();

    const alertTimer = setInterval(() => {
      checkAlertsFromStore();
    }, 10 * 60 * 1000);

    const forecastTimer = setInterval(() => {
      checkForecastNotification();
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(alertTimer);
      clearInterval(forecastTimer);
    };
  }, []);

  // 监听 AI 助手的天气指令
  useEffect(() => {
    if (!window.electronAPI?.onMenuEvent) return;

    const unsubscribeCurrent = window.electronAPI.onMenuEvent('weather:get-current', async () => {
      const current = await fetchWeather();
      if (current) {
        // 创建临时播报数据
        const mockBriefing: DailyBriefingType = {
          type: 'morning',
          greeting: '当前天气',
          currentWeather: `${current.cityName || '当前位置'} ${current.label} ${current.temperature}`,
          todayForecast: `${current.label}，${current.temperature}，湿度 ${current.humidity || '--'}`,
          alerts: [],
          outfitAdvice: '',
          activityAdvice: '',
          healthAdvice: ''
        };
        setBriefingData(mockBriefing);
        setBriefingMode('morning');
        setBriefingVisible(true);
      }
    });

    const unsubscribeForecast = window.electronAPI.onMenuEvent('weather:get-forecast', async (data: { days?: number }) => {
      const forecast = await fetchWeatherForecast();
      if (forecast) {
        const days = data?.days || 3;
        const forecastText = forecast.slice(0, days).map((f, i) => 
          `${i === 0 ? '今天' : i === 1 ? '明天' : '后天'}：${f.weatherLabel}，${f.minTemp}°C~${f.maxTemp}°C`
        ).join('\n');
        
        const mockBriefing: DailyBriefingType = {
          type: 'morning',
          greeting: '天气预报',
          currentWeather: forecastText,
          todayForecast: '',
          alerts: [],
          outfitAdvice: '',
          activityAdvice: '',
          healthAdvice: ''
        };
        setBriefingData(mockBriefing);
        setBriefingMode('morning');
        setBriefingVisible(true);
      }
    });

    const unsubscribeAlerts = window.electronAPI.onMenuEvent('weather:get-alerts', async () => {
      const storeAlerts = useWeatherStore.getState().alerts;
      if (storeAlerts.length > 0) {
        setActiveAlerts(storeAlerts);
        setAlertPopupVisible(true);
      } else {
        const mockBriefing: DailyBriefingType = {
          type: 'morning',
          greeting: '天气预警',
          currentWeather: '当前没有天气预警',
          todayForecast: '天气状况良好，无需担心',
          alerts: [],
          outfitAdvice: '',
          activityAdvice: '',
          healthAdvice: ''
        };
        setBriefingData(mockBriefing);
        setBriefingMode('alert');
        setBriefingVisible(true);
      }
    });

    const unsubscribeToggleAlerts = window.electronAPI.onMenuEvent('weather:toggle-alerts', (data: { enabled: boolean }) => {
      const pref = getUserPreference();
      pref.enableAlerts = data.enabled;
      saveUserPreference(pref);
    });

    const unsubscribeSetTime = window.electronAPI.onMenuEvent('weather:set-briefing-time', (data: { type: 'morning' | 'evening', time: string }) => {
      const pref = getUserPreference();
      if (data.type === 'morning') {
        pref.morningBriefingTime = data.time;
      } else {
        pref.eveningBriefingTime = data.time;
      }
      saveUserPreference(pref);
    });

    const unsubscribeShowBriefing = window.electronAPI.onMenuEvent('weather:show-briefing', async () => {
      const hour = new Date().getHours();
      const type: 'morning' | 'evening' = hour >= 12 ? 'evening' : 'morning';
      const briefing = await generateDailyBriefing(type);
      if (briefing) {
        setBriefingData(briefing);
        setBriefingMode(type);
        setBriefingVisible(true);
      }
    });

    // 监听定位模式切换
    const unsubscribeSetLocationMode = window.electronAPI.onMenuEvent('weather:set-location-mode', async (data: { mode: 'auto' | 'manual' }) => {
      const { saveManualCity, getWeatherMode } = await import('../utils/weather');
      
      if (data.mode === 'auto') {
        // 切换到自动定位模式 - 清除手动城市设置
        await saveManualCity(null);
        updateWeatherMode('auto');
        // 重新获取天气
        clearWeatherCache();
        const newWeather = await fetchWeather();
        updateWeather(newWeather);
        const { city } = await getCurrentCity();
        updateCurrentCity(city);
      } else {
        // 切换到手动模式 - 打开城市选择器
        setCitySelectorVisible(true);
        updateWeatherMode('manual');
      }
    });

    // 监听打开城市选择器
    const unsubscribeOpenCitySelector = window.electronAPI.onMenuEvent('weather:open-city-selector', () => {
      setCitySelectorVisible(true);
    });

    // 监听获取定位信息
    const unsubscribeGetLocationInfo = window.electronAPI.onMenuEvent('weather:get-location-info', async () => {
      const { city, mode } = await getCurrentCity();
      const modeText = mode === 'auto' ? '自动定位' : '手动选择';
      const cityName = city?.name || '未设置';
      
      const mockBriefing: DailyBriefingType = {
        type: 'morning',
        greeting: '天气定位信息',
        currentWeather: message,
        todayForecast: '',
        alerts: [],
        outfitAdvice: '',
        activityAdvice: '',
        healthAdvice: ''
      };
      setBriefingData(mockBriefing);
      setBriefingMode('morning');
      setBriefingVisible(true);
    });

    // 监听 AI 助手的天气操作结果（统一入口）
    const unsubscribeAiResponse = window.electronAPI.onMenuEvent('weather:ai-response', async (data: any) => {
      if (!data) return;

      switch (data.action) {
        case 'show_current': {
          // AI 查询当前天气 → 弹出天气播报卡片
          const d = data.data;
          const mockBriefing: DailyBriefingType = {
            type: 'morning',
            greeting: '当前天气',
            currentWeather: `${d.city} ${d.weatherLabel} ${d.temperature}°C`,
            todayForecast: `风速 ${d.windSpeed}km/h，湿度 ${d.humidity}%`,
            alerts: [],
            outfitAdvice: '',
            activityAdvice: '',
            healthAdvice: ''
          };
          setBriefingData(mockBriefing);
          setBriefingMode('morning');
          setBriefingVisible(true);
          break;
        }
        case 'show_forecast': {
          // AI 查询天气预报 → 弹出预报卡片
          const d = data.data;
          const forecastText = d.forecasts.slice(0, 3).map((f: any, i: number) => {
            const dayName = i === 0 ? '今天' : i === 1 ? '明天' : '后天';
            return `${dayName}：${f.weatherLabel}，${f.minTemp}°C ~ ${f.maxTemp}°C`;
          }).join('\n');
          const mockBriefing: DailyBriefingType = {
            type: 'morning',
            greeting: `${d.city} 天气预报`,
            currentWeather: forecastText,
            todayForecast: '',
            alerts: [],
            outfitAdvice: '',
            activityAdvice: '',
            healthAdvice: ''
          };
          setBriefingData(mockBriefing);
          setBriefingMode('morning');
          setBriefingVisible(true);
          break;
        }
        case 'show_alerts': {
          // AI 查询预警 → 弹出预警通知
          const d = data.data;
          if (d.alerts && d.alerts.length > 0) {
            setActiveAlerts(d.alerts);
            setAlertNotification({
              visible: true,
              alert: d.alerts[0],
            });
          }
          break;
        }
        case 'show_briefing': {
          // AI 查询每日播报 → 弹出完整播报卡片
          const d = data.data;
          const mockBriefing: DailyBriefingType = {
            type: d.tomorrow ? 'evening' : 'morning',
            greeting: d.greeting,
            currentWeather: d.today,
            todayForecast: d.tomorrow || '',
            alerts: d.alerts || [],
            outfitAdvice: d.outfitAdvice || '',
            activityAdvice: d.activityAdvice || '',
            healthAdvice: d.healthAdvice || ''
          };
          setBriefingData(mockBriefing);
          setBriefingMode(d.tomorrow ? 'evening' : 'morning');
          setBriefingVisible(true);
          break;
        }
        case 'trigger_forecast_notification': {
          // AI 即时触发预报通知
          const d = data.data;
          if (d.tomorrow) {
            setForecastNotification({
              visible: true,
              forecast: d.tomorrow,
            });
          }
          break;
        }
        case 'trigger_alert_notification': {
          // AI 即时触发预警通知
          const d = data.data;
          if (d.alerts && d.alerts.length > 0) {
            setActiveAlerts(d.alerts);
            setAlertNotification({
              visible: true,
              alert: d.alerts[0],
            });
          }
          break;
        }
      }
    });

    return () => {
      unsubscribeCurrent?.();
      unsubscribeForecast?.();
      unsubscribeAlerts?.();
      unsubscribeToggleAlerts?.();
      unsubscribeSetTime?.();
      unsubscribeShowBriefing?.();
      unsubscribeSetLocationMode?.();
      unsubscribeOpenCitySelector?.();
      unsubscribeGetLocationInfo?.();
      unsubscribeAiResponse?.();
    };
  }, []);

  useEffect(() => {
    fetchCreativities({ page: 1, pageSize: 10 });
    fetchStats();
    fetchBoards();
  }, [fetchCreativities, fetchStats, fetchBoards]);

  // 处理城市选择
  const handleCitySelect = async (result: { city: City | null; mode: WeatherMode }) => {
    updateCurrentCity(result.city);
    updateWeatherMode(result.mode);
    // 清除缓存并重新获取天气
    clearWeatherCache();
    const newWeather = await fetchWeather();
    updateWeather(newWeather);
  };

  useEffect(() => {
    if (prevCountRef.current > 0 && creativities.length !== prevCountRef.current) {
      fetchStats();
    }
    prevCountRef.current = creativities.length;
  }, [creativities.length, fetchStats]);

  const FLASHBACK_COUNT = 3;
  
  // 媒体预加载
  const preloadMedia = useCallback((creativity: Creativity) => {
    const url = creativity.mediaFilePath || creativity.content;
    if (!url) return;
    try {
      const mediaUrl = toMediaUrl(url);
      if (creativity.type === 'image') {
        new Image().src = mediaUrl;
      }
    } catch {
      // 忽略无效URL
    }
  }, []);

  const loadFlashback = async () => {
    if (flashbackAutoTimerRef.current) {
      clearTimeout(flashbackAutoTimerRef.current);
      flashbackAutoTimerRef.current = null;
    }
    Object.values(flashbackMediaRefs.current).forEach((mediaRef) => {
      if (mediaRef && !mediaRef.paused) {
        const fbId = Object.keys(flashbackMediaRefs.current).find(
          (key) => flashbackMediaRefs.current[key] === mediaRef
        );
        if (fbId) flashbackProgrammaticPauseRef.current[fbId] = true;
        mediaRef.pause();
      }
    });
    flashbackUserPausedRef.current = {};
    setRefreshSpinning(true);
    setFlashbackLoading(true);
    setFlashbackImgErrors({});
    setFlashbackMediaSizes({});
    const results = await Promise.all(
      Array.from({ length: FLASHBACK_COUNT }, () => getRandomCreativity())
    );
    const valid = results.filter((r): r is Creativity => r !== null);
    // 预加载媒体资源
    valid.forEach(r => preloadMedia(r));
    setFlashbacks(valid);
    setActiveFlashbackIndex(0);
    activeFlashbackIndexRef.current = 0;
    setFlashbackLoading(false);
  };

  useEffect(() => { loadFlashback(); }, []);

  // 优化后的ResizeObserver
  useEffect(() => {
    const el = flashbackCardRef.current;
    if (!el) return;

    let rafId: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const height = el.offsetHeight;
        if (height > 0) {
          setFlashbackHeight(prev =>
            prev !== undefined && Math.abs(prev - height) < 5 ? prev : height
          );
        }
      });
    });

    observer.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [activeFlashbackIndex]);

  // 媒体ref清理
  useEffect(() => {
    return () => {
      Object.values(flashbackMediaRefs.current).forEach(media => {
        if (media) {
          media.pause();
          media.src = '';
        }
      });
      flashbackMediaRefs.current = {};
    };
  }, []);

  const tryPlayActiveMedia = useCallback((fbId: string) => {
    if (document.hidden) return;
    // 如果用户之前手动暂停过该媒体，则不自动恢复播放
    if (flashbackUserPausedRef.current[fbId]) return;
    const mediaEl = flashbackMediaRefs.current[fbId];
    if (!mediaEl) return;
    const saved = flashbackPlayingState.current[fbId];
    if (saved && isFinite(saved.currentTime)) {
      mediaEl.currentTime = saved.currentTime;
    }
    mediaEl.play().catch(() => {
      setTimeout(() => {
        const el = flashbackMediaRefs.current[fbId];
        if (el && el.paused && !el.ended && !document.hidden && !flashbackUserPausedRef.current[fbId]) {
          el.play().catch(() => {});
        }
      }, 200);
    });
  }, []);

  const goToNextFlashback = useCallback(() => {
    if (flashbacks.length > 1) {
      // 先暂停所有媒体
      flashbacks.forEach((fb) => {
        const mediaEl = flashbackMediaRefs.current[fb.id];
        if (mediaEl && !mediaEl.paused) {
          flashbackPlayingState.current[fb.id] = {
            playing: true,
            currentTime: mediaEl.currentTime,
          };
          flashbackProgrammaticPauseRef.current[fb.id] = true;
          mediaEl.pause();
        }
      });
      const nextIndex = (activeFlashbackIndex + 1) % flashbacks.length;
      setActiveFlashbackIndex(nextIndex);
      activeFlashbackIndexRef.current = nextIndex;
      const newFb = flashbacks[nextIndex];
      if (newFb && (newFb.type === 'video' || newFb.type === 'audio')) {
        // 延迟播放新页媒体，等 AnimatePresence 退出动画完成
        setTimeout(() => {
          if (activeFlashbackIndexRef.current === nextIndex) {
            tryPlayActiveMedia(newFb.id);
          }
        }, 350);
      }
      if (!document.hidden) {
        scheduleFlashbackSwitchRef.current(nextIndex);
      }
    }
  }, [flashbacks, activeFlashbackIndex, tryPlayActiveMedia]);

  goToNextFlashbackRef.current = goToNextFlashback;

  const goToPrevFlashback = useCallback(() => {
    if (flashbacks.length > 1) {
      // 先暂停所有媒体
      flashbacks.forEach((fb) => {
        const mediaEl = flashbackMediaRefs.current[fb.id];
        if (mediaEl && !mediaEl.paused) {
          flashbackPlayingState.current[fb.id] = {
            playing: true,
            currentTime: mediaEl.currentTime,
          };
          flashbackProgrammaticPauseRef.current[fb.id] = true;
          mediaEl.pause();
        }
      });
      const prevIndex = (activeFlashbackIndex - 1 + flashbacks.length) % flashbacks.length;
      setActiveFlashbackIndex(prevIndex);
      activeFlashbackIndexRef.current = prevIndex;
      const newFb = flashbacks[prevIndex];
      if (newFb && (newFb.type === 'video' || newFb.type === 'audio')) {
        // 延迟播放新页媒体，等 AnimatePresence 退出动画完成
        setTimeout(() => {
          if (activeFlashbackIndexRef.current === prevIndex) {
            tryPlayActiveMedia(newFb.id);
          }
        }, 350);
      }
      if (!document.hidden) {
        scheduleFlashbackSwitchRef.current(prevIndex);
      }
    }
  }, [flashbacks, activeFlashbackIndex, tryPlayActiveMedia]);

  const scheduleFlashbackSwitch = useCallback((overrideIndex?: number) => {
    if (flashbackAutoTimerRef.current) {
      clearTimeout(flashbackAutoTimerRef.current);
      flashbackAutoTimerRef.current = null;
    }
    const idx = overrideIndex !== undefined ? overrideIndex : activeFlashbackIndex;
    const currentFb = flashbacks[idx];
    if (!currentFb) return;
    if (currentFb.type === 'video' || currentFb.type === 'audio') {
      const mediaEl = flashbackMediaRefs.current[currentFb.id];
      if (mediaEl && mediaEl.duration && isFinite(mediaEl.duration) && mediaEl.duration <= 8) {
        flashbackAutoTimerRef.current = setTimeout(() => goToNextFlashbackRef.current(), 8000);
      }
    } else {
      flashbackAutoTimerRef.current = setTimeout(() => goToNextFlashbackRef.current(), 8000);
    }
  }, [flashbacks, activeFlashbackIndex]);

  scheduleFlashbackSwitchRef.current = scheduleFlashbackSwitch;

  const handleFlashbackMediaEnded = useCallback((fbId: string) => {
    flashbackUserPausedRef.current[fbId] = false;
    const currentFb = flashbacks[activeFlashbackIndex];
    if (currentFb && currentFb.id === fbId) {
      if (flashbackAutoTimerRef.current) {
        clearTimeout(flashbackAutoTimerRef.current);
      }
      flashbackAutoTimerRef.current = setTimeout(() => goToNextFlashbackRef.current(), 1500);
    }
  }, [flashbacks, activeFlashbackIndex]);

  const handleFlashbackMediaPause = useCallback((fbId: string) => {
    if (flashbackProgrammaticPauseRef.current[fbId]) {
      flashbackProgrammaticPauseRef.current[fbId] = false;
      return;
    }
    const mediaEl = flashbackMediaRefs.current[fbId];
    if (mediaEl && mediaEl.ended) return;
    flashbackUserPausedRef.current[fbId] = true;
    if (flashbackAutoTimerRef.current) {
      clearTimeout(flashbackAutoTimerRef.current);
      flashbackAutoTimerRef.current = null;
    }
  }, []);

  const handleFlashbackMediaPlay = useCallback((fbId: string) => {
    flashbackUserPausedRef.current[fbId] = false;
    scheduleFlashbackSwitchRef.current();
  }, []);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevFlashback();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextFlashback();
      } else if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        loadFlashback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevFlashback, goToNextFlashback, loadFlashback]);

  // 悬停暂停自动轮播
  useEffect(() => {
    if (isHoveringFlashback && flashbackAutoTimerRef.current) {
      clearTimeout(flashbackAutoTimerRef.current);
      flashbackAutoTimerRef.current = null;
    } else if (!isHoveringFlashback && flashbacks.length > 0) {
      scheduleFlashbackSwitchRef.current();
    }
  }, [isHoveringFlashback, flashbacks.length]);

  useEffect(() => {
    // 暂停所有非当前页的媒体
    flashbacks.forEach((fb, index) => {
      const mediaEl = flashbackMediaRefs.current[fb.id];
      if (!mediaEl) return;
      if (index !== activeFlashbackIndex && !mediaEl.paused) {
        flashbackPlayingState.current[fb.id] = {
          playing: true,
          currentTime: mediaEl.currentTime,
        };
        flashbackProgrammaticPauseRef.current[fb.id] = true;
        mediaEl.pause();
      }
    });
    // 延迟播放当前页媒体，等 AnimatePresence 退出动画完成
    const timer = setTimeout(() => {
      const activeFb = flashbacks[activeFlashbackIndex];
      if (activeFb && (activeFb.type === 'video' || activeFb.type === 'audio')) {
        tryPlayActiveMedia(activeFb.id);
      }
      if (!document.hidden) {
        scheduleFlashbackSwitchRef.current();
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      if (flashbackAutoTimerRef.current) {
        clearTimeout(flashbackAutoTimerRef.current);
      }
    };
  }, [activeFlashbackIndex, flashbacks, tryPlayActiveMedia]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        flashbacks.forEach((fb) => {
          const mediaEl = flashbackMediaRefs.current[fb.id];
          if (mediaEl && !mediaEl.paused) {
            flashbackPlayingState.current[fb.id] = {
              playing: true,
              currentTime: mediaEl.currentTime,
            };
            flashbackProgrammaticPauseRef.current[fb.id] = true;
            mediaEl.pause();
          }
        });
        if (flashbackAutoTimerRef.current) {
          clearTimeout(flashbackAutoTimerRef.current);
          flashbackAutoTimerRef.current = null;
        }
      } else {
        const activeFb = flashbacks[activeFlashbackIndex];
        if (activeFb && (activeFb.type === 'video' || activeFb.type === 'audio')) {
          tryPlayActiveMedia(activeFb.id);
        }
        scheduleFlashbackSwitchRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flashbacks, activeFlashbackIndex, tryPlayActiveMedia]);

  const handleItemClick = useCallback((item: Creativity) => {
    if (!item.isRead) {
      api.creativity.update(item.id, { isRead: true });
    }
    if (item.type === 'image' && isPureMediaContent(item.content)) {
      setDirectImagePreview(item);
    } else {
      setPreviewItem(item);
      setPreviewOpen(true);
    }
  }, []);

  const handleEdit = useCallback((item: Creativity) => {
    setContextMenu(null);
    useUIStore.getState().openEditor(item);
  }, []);

  const handleSaveCreativity = useCallback(async (data: any) => {
    try {
      return await updateCreativity(data.id, {
        title: data.title,
        content: data.content,
        type: data.type,
        subtype: data.subtype,
        contentFormat: data.contentFormat,
        wordCount: data.wordCount,
        priority: data.priority,
        emojiReaction: data.emojiReaction,
        tags: data.tags,
        cardStyle: data.cardStyle,
        isFavorite: data.isFavorite,
      });
    } catch (error) {
      console.error('保存失败:', error);
      return false;
    }
  }, [updateCreativity]);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: Creativity) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const closeContextMenu = useCallback(() => { setContextMenu(null); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('.ant-menu')) return;
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, closeContextMenu]);

  const handleContextAction = useCallback(async (action: string) => {
    if (!contextMenu) return;
    const item = contextMenu.item;
    
    // 检查是否是发送到画布的命令
    if (action.startsWith('board-')) {
      const boardId = action.replace('board-', '');
      try {
        await api.board.canvas.addItem(boardId, item.id, 100 + Math.random() * 300, 100 + Math.random() * 300, undefined, undefined, null, null, null, true);
        await api.board.addCreativityRelation(boardId, item.id);
        await fetchBoards();
        useUIStore.getState().showToast('success', '已发送至画布');
      } catch (error) {
        useUIStore.getState().showToast('error', '发送失败');
      }
      closeContextMenu();
      return;
    }
    
    closeContextMenu();
    switch (action) {
      case 'edit': handleEdit(item); break;
      case 'favorite': {
        const isFav = item.isFavorite || (item as any).is_favorite === 1;
        const updated = await api.creativity.toggleFavorite(item.id);
        if (updated) {
          // 立即更新本地状态
          useCreativityStore.setState((state) => ({
            creativities: state.creativities.map(c => c.id === item.id ? { ...c, isFavorite: updated.isFavorite } : c),
          }));
          setFlashbacks(prev => prev.map(fb => fb.id === item.id ? { ...fb, isFavorite: updated.isFavorite } : fb));
        }
        useUIStore.getState().showToast('success', isFav ? '已取消收藏' : '已收藏');
        fetchCreativities({ page: 1, pageSize: 10 });
        fetchStats();
        break;
      }
      case 'trash':
        await api.creativity.delete(item.id);
        fetchCreativities({ page: 1, pageSize: 10 });
        fetchStats();
        break;
      default:
        if (action.startsWith('ai-')) {
          const title = item.title || '未命名创意';
          const type = item.type || 'text';
          const ref = `[创意ID: ${item.id} | 标题: ${title} | 类型: ${type}]`;
          const creativityRef = {
            id: item.id,
            title,
            type,
            content: item.content || '',
            mediaFilePath: item.mediaFilePath || item.mediaUrl || '',
            tags: item.tags || [],
          };
          const aiPanelMode = useUIStore.getState().aiPanelMode;
          const sendMessage = useAIStore.getState().sendMessage;
          if (aiPanelMode === 'closed') useUIStore.getState().openAiMini();
          let prompt = '';
          switch (action) {
            case 'ai-discuss':
              prompt = `我想和你讨论一个创意 ${ref}，请先用 read_creativity_full 工具查看它的完整内容，然后帮我分析这个创意，给出你的看法和建议。`;
              break;
            case 'ai-continue':
              prompt = `请帮我续写和拓展创意 ${ref}，先用 read_creativity_full 工具查看完整内容，再基于内容进行续写。`;
              break;
            case 'ai-rewrite':
              prompt = `请帮我润色和改写创意 ${ref}，先用 read_creativity_full 工具查看完整内容，然后润色使其表达更清晰、更有吸引力，最后用 update_creativity 工具保存修改。`;
              break;
            case 'ai-tags':
              prompt = `请为创意 ${ref} 生成合适的标签，先用 read_creativity_full 工具查看内容，然后用 create_tag 工具创建标签，再用 tag_creativity 工具给创意打上标签。`;
              break;
            case 'ai-translate':
              prompt = `请将创意 ${ref} 的内容翻译为英文，先用 read_creativity_full 工具查看完整内容，然后进行翻译。`;
              break;
          }
          if (prompt) setTimeout(() => sendMessage(prompt, undefined, [creativityRef]), 100);
        }
        break;
    }
  }, [contextMenu, closeContextMenu, updateCreativity, fetchCreativities, fetchStats, handleEdit]);


  const statItems = [
    { label: '总创意', value: stats?.total ?? 0, icon: FileText, color: 'var(--primary-color)' },
    { label: '今日', value: stats?.today ?? 0, icon: TrendingUp, color: 'var(--success-color)' },
    { label: '本周', value: stats?.thisWeek ?? 0, icon: Clock, color: 'var(--info-color)' },
    { label: '标签', value: stats?.tags ?? 0, icon: ShootingStar, color: 'var(--warning-color)' },
  ];

  const [prevStatValues, setPrevStatValues] = useState<number[]>([0, 0, 0, 0]);
  const [animatingStats, setAnimatingStats] = useState<Set<number>>(new Set());

  const keycapStyle: React.CSSProperties = {
    borderWidth: '2px 2px 4px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 0, 0, 0.12)',
    boxShadow: 'rgba(0, 0, 0, 0.114) 0px 4px 0px, rgba(255, 255, 255, 0.14) 0px 2px 0px inset',
  };

  const keycapHover = {
    y: 3,
    borderWidth: '2px 2px 2px',
    transition: { type: 'spring', stiffness: 400, damping: 15, mass: 0.5 },
  };

  useEffect(() => {
    const currentValues = statItems.map(s => s.value);
    const changed = new Set<number>();
    for (let i = 0; i < currentValues.length; i++) {
      if (currentValues[i] !== prevStatValues[i]) {
        changed.add(i);
      }
    }
    if (changed.size > 0) {
      setAnimatingStats(changed);
      setPrevStatValues(currentValues);
      setTimeout(() => setAnimatingStats(new Set()), 600);
    }
  }, [stats]);

  const recentBoards = boards.slice(0, 3);





  return (
    <div ref={homeContainerRef} style={{ padding: '24px', position: 'relative' }}>
      <WeatherBackground intensity={0.5} />

      {locationFailed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 16px',
            marginBottom: 12,
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <MapPin size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              自动定位失败，请手动选择城市
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                setCitySelectorVisible(true);
                dismissLocationFail();
              }}
              style={{
                background: 'var(--primary-color)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              选择城市
            </button>
            <button
              onClick={dismissLocationFail}
              style={{
                background: 'rgba(0,0,0,0.06)',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              忽略
            </button>
          </div>
        </motion.div>
      )}
      {/* 欢迎条 + 统计 - 保留这个漂亮的渐变效果 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
          borderRadius: '12px',
          padding: '20px 28px',
          color: 'white',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* 琉光特效 1 - 主流动光 */}
        <motion.div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 25%, rgba(255,215,0,0.3) 50%, rgba(255,255,255,0.4) 75%, transparent 100%)',
            pointerEvents: 'none',
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* 琉光特效 2 - 第二层流动光 */}
        <motion.div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,105,180,0.25) 30%, rgba(138,43,226,0.25) 50%, rgba(0,191,255,0.25) 70%, transparent 100%)',
            pointerEvents: 'none',
          }}
          animate={{
            x: ['100%', '-200%'],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* 动态彩色光斑 */}
        <motion.div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-20%',
            width: '140%',
            height: '140%',
            background: 'radial-gradient(ellipse at 30% 30%, rgba(255,105,180,0.3) 0%, transparent 40%), radial-gradient(ellipse at 70% 70%, rgba(0,191,255,0.3) 0%, transparent 40%), radial-gradient(ellipse at 50% 50%, rgba(138,43,226,0.2) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
          animate={{
            x: [0, 20, -10, 0],
            y: [0, -15, 25, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* 旋转光晕 */}
        <motion.div
          style={{
            position: 'absolute',
            top: '-30%',
            left: '-30%',
            width: '160%',
            height: '160%',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 40%)',
            pointerEvents: 'none',
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ 
              fontSize: '26px', 
              fontWeight: 700, 
              margin: 0,
              fontFamily: 'var(--font-title)',
              letterSpacing: '1px',
            }}>脑洞集</h2>
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0, fontFamily: 'var(--font-special)' }}>
              {currentTime.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '16px',
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
            padding: '12px 20px', borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <FlipDigit digit={Math.floor(currentTime.getHours() / 10)} />
              <FlipDigit digit={currentTime.getHours() % 10} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '0 4px' }}>
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff' }} />
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity, delay: 0.5 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff' }} />
              </div>
              <FlipDigit digit={Math.floor(currentTime.getMinutes() / 10)} />
              <FlipDigit digit={currentTime.getMinutes() % 10} />
            </div>

            {weather && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <WeatherIcon 
                    code={weather.weatherCode} 
                    isDay={weather.isDay} 
                    size={40} 
                  />
                  <span style={{ fontSize: '10px', opacity: 0.9, color: '#fff', fontWeight: 500 }}>
                    {weather.label}
                  </span>
                </div>
                <div 
                  style={{ display: 'flex', flexDirection: 'column', gap: '1px', cursor: 'pointer' }}
                  onClick={() => setWeatherDetailVisible(true)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCitySelectorVisible(true);
                  }}
                  onDoubleClick={async () => {
                    if (weatherMode === 'auto') {
                      console.log('[Home] Double-clicked weather, refreshing location...');
                      const refreshed = await refreshWeather();
                      if (refreshed) {
                        updateWeather(refreshed);
                        const { city } = await getCurrentCity();
                        updateCurrentCity(city);
                      }
                    }
                  }}
                  title="点击查看天气详情，右键切换城市"
                >
                  <span style={{ fontSize: '16px', fontWeight: 700, lineHeight: '1.2', color: '#fff' }}>{weather.temperature}</span>
                  <span style={{ fontSize: '11px', opacity: 0.75, lineHeight: '1.2', color: '#fff' }}>
                    {displayCityName}
                  </span>
                </div>
                <motion.button
                  onClick={() => setCitySelectorVisible(true)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    cursor: 'pointer', border: 'none',
                    color: '#fff',
                  }}
                  title="切换城市"
                >
                  <MapPin size={16} />
                </motion.button>
              </motion.div>
            )}
            {!weather && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginLeft: '8px', 
                  paddingLeft: '16px', 
                  borderLeft: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <span style={{ fontSize: '13px', color: '#fff', opacity: 0.5 }}>
                  加载中...
                </span>
              </motion.div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
          {statItems.map((stat, idx) => (
            <motion.div
              key={stat.label}
              whileHover={{ y: 3, scale: 0.95 }}
              whileTap={{ y: 4, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
              style={{ textAlign: 'center', minWidth: '56px', overflow: 'hidden', height: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', cursor: 'default' }}
            >
              <div style={{ position: 'relative', height: '26px', overflow: 'hidden' }}>
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`${stat.label}-${stat.value}`}
                    initial={animatingStats.has(idx) ? { y: -30, opacity: 0, scale: 0.8 } : false}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 30, opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{ fontSize: '22px', fontWeight: 700, lineHeight: '1.2' }}
                  >
                    {stat.value}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div style={{
                fontSize: '11px',
                marginTop: '2px',
                padding: '1px 8px',
                borderRadius: 9999,
                color: 'var(--text-secondary)',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderWidth: '1px 1px 2px',
                borderStyle: 'solid',
                borderColor: 'rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0.06) rgba(0, 0, 0, 0.1) rgba(255, 255, 255, 0.12)',
                boxShadow: 'rgba(0, 0, 0, 0.06) 0px 2px 0px, rgba(255, 255, 255, 0.15) 0px 1px 0px inset, rgba(255, 255, 255, 0.05) 0px 0px 4px inset',
              }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 主内容区：灵感闪回 + 最近创意 + 最近创意库 */}
      <div className={recentBoards.length > 0 ? 'home-grid' : 'home-grid home-grid--no-boards'}>
        {/* 灵感闪回 - 用Ant Card */}
        <div style={{ position: 'relative' }}>
        {flashbacks.length > 1 && (
          <>
            <button
              onClick={goToPrevFlashback}
              className="flashback-nav-btn flashback-nav-btn--prev"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goToNextFlashback}
              className="flashback-nav-btn flashback-nav-btn--next"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
        <motion.div
          ref={flashbackCardRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Popover content="🔥兄弟，借个火！这是秦始皇下的圣诏！" trigger="hover">
                <div className="keycap-hover-anim home-icon-btn" style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...keycapStyle,
                }}>
                  <DnxcIcon size={16} />
                </div>
                </Popover>
                <span style={{ fontFamily: 'var(--font-title)' }}>灵感闪回</span>
              </div>
            }
            extra={
              <motion.div whileHover={{ y: 2, transition: { type: 'spring', stiffness: 400, damping: 15, mass: 0.5 } }} style={{ display: 'inline-block' }}>
              <Button 
                type="text" 
                size="small" 
                onClick={loadFlashback} 
                icon={
                  <motion.div
                    animate={refreshSpinning ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    onAnimationComplete={() => setRefreshSpinning(false)}
                    style={{ display: 'inline-flex' }}
                  >
                    <RefreshCw size={12} />
                  </motion.div>
                }
                style={{
                  border: '1px solid var(--primary-color)',
                  background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
                  color: 'var(--primary-color)',
                  borderRadius: '6px',
                }}
              >
                换一个
              </Button>
              </motion.div>
            }
            style={{ display: 'flex', flexDirection: 'column', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}
          >
            <div style={{ position: 'relative' }}>
              <AnimatePresence mode="wait">
                {flashbacks.length > 0 ? (() => {
                  const fb = flashbacks[activeFlashbackIndex];
                  if (!fb) return null;
                  return (
                    <motion.div
                      key={fb.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-light)',
                        transition: 'all 0.2s ease',
                        ...(fb.mediaFilePath || fb.type === 'video' || fb.type === 'image' || fb.type === 'audio' || fb.type === 'document' || fb.type === 'other' ? { width: 'fit-content', maxWidth: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' as const } : {}),
                      }}
                      onClick={() => { if (justDraggedRef.current) return; handleItemClick(fb); }}
                      onMouseDown={(e) => handleItemDragStart(e, fb)}
                      onContextMenu={(e) => handleContextMenu(e, fb)}
                      onMouseEnter={() => setIsHoveringFlashback(true)}
                      onMouseLeave={() => setIsHoveringFlashback(false)}
                      className="flashback-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', minWidth: 0, flexWrap: 'wrap' }}>
                        <HomeThumbnail
                          type={fb.type}
                          content={fb.content}
                          mediaFilePath={fb.mediaFilePath}
                          thumbnailPath={fb.thumbnailPath}
                          size={24}
                          iconSize={14}
                          iconColor="var(--primary-color)"
                          bg="var(--primary-bg)"
                          style={{ borderRadius: '4px', ...keycapStyle }}
                          onClick={(e) => { e.stopPropagation(); handleItemClick(fb); }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{getCreativityTypeLabel(fb.type)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>-</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatRelativeTime(fb.createdAt)}</span>
                      </div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: '0 0 8px 0',
                        fontFamily: 'var(--font-title)',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        // 让标题不参与 fit-content 宽度计算，但渲染时仍填满卡片
                        width: 0,
                        minWidth: '100%',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                      }}>{fb.title}</h4>
                      {(fb.type === 'image' || fb.type === 'video' || fb.type === 'audio') && (fb.content || fb.mediaFilePath) && (() => {
                        const resolved = fb.mediaFilePath || fb.content;
                        const mediaUrl = resolved ? toMediaUrl(resolved) : '';
                        if (!mediaUrl) { return null; }
                        if (fb.type === 'image' && !flashbackImgErrors[fb.id]) {
                          const imgMediaSize = flashbackMediaSizes[fb.id];
                          const imgIsLandscape = imgMediaSize ? imgMediaSize.width >= imgMediaSize.height : true;
                          const imgMaxH = getFlashbackMaxHeight(imgIsLandscape);
                          return (
                              <img
                                src={mediaUrl}
                                alt=""
                                draggable={false}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  display: 'block',
                                  maxWidth: '100%',
                                  maxHeight: imgMaxH,
                                  marginBottom: 8,
                                  borderRadius: 8,
                                }}
                                onError={() => setFlashbackImgErrors(prev => ({ ...prev, [fb.id]: true }))}
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  if (img.naturalWidth && img.naturalHeight) {
                                    setFlashbackMediaSizes(prev => ({ ...prev, [fb.id]: { width: img.naturalWidth, height: img.naturalHeight } }));
                                  }
                                }}
                              />
                          );
                        }
                        if (fb.type === 'video') {
                          const mediaSize = flashbackMediaSizes[fb.id];
                          const isLandscape = mediaSize ? mediaSize.width >= mediaSize.height : true;
                          const maxH = getFlashbackMaxHeight(isLandscape);
                          let playerStyle: React.CSSProperties = {
                            maxWidth: '100%',
                            maxHeight: maxH,
                            marginBottom: 8,
                            borderRadius: 8,
                          };
                          if (mediaSize && mediaSize.height > maxH) {
                            const scale = maxH / mediaSize.height;
                            playerStyle = {
                              width: Math.round(mediaSize.width * scale),
                              maxWidth: '100%',
                              marginBottom: 8,
                              borderRadius: 8,
                            };
                          }
                          return (
                              <FlashbackVideoPlayer
                                src={mediaUrl}
                                muted={flashbackVolumeRef.current.muted}
                                volume={flashbackVolumeRef.current.volume}
                                style={playerStyle}
                                videoRef={(el) => { flashbackMediaRefs.current[fb.id] = el; }}
                                onLoadedMetadata={(video) => {
                                  if (video.videoWidth && video.videoHeight) {
                                    setFlashbackMediaSizes(prev => ({ ...prev, [fb.id]: { width: video.videoWidth, height: video.videoHeight } }));
                                  }
                                  video.volume = flashbackVolumeRef.current.volume;
                                  if (!document.hidden) {
                                    tryPlayActiveMedia(fb.id);
                                  }
                                }}
                                onVolumeChange={(vol, muted) => {
                                  flashbackVolumeRef.current = { volume: vol, muted };
                                  try { localStorage.setItem('mindvault:flashback:volume', JSON.stringify(flashbackVolumeRef.current)); } catch {}
                                }}
                                onEnded={() => handleFlashbackMediaEnded(fb.id)}
                                onPause={() => handleFlashbackMediaPause(fb.id)}
                                onPlay={() => handleFlashbackMediaPlay(fb.id)}
                              />
                          );
                        }
                        if (fb.type === 'audio') {
                          return (
                            <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Mic size={16} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                              <audio
                                ref={(el) => { flashbackMediaRefs.current[fb.id] = el; }}
                                src={mediaUrl}
                                autoPlay={false}
                                muted={flashbackVolumeRef.current.muted}
                                controls
                                style={{ flex: 1, height: 32, minWidth: 0 }}
                                onLoadedMetadata={() => {
                                  const audio = flashbackMediaRefs.current[fb.id] as HTMLAudioElement | null;
                                  if (audio) {
                                    audio.volume = flashbackVolumeRef.current.volume;
                                    if (!document.hidden) {
                                      tryPlayActiveMedia(fb.id);
                                    }
                                  }
                                }}
                                onVolumeChange={() => {
                                  const audio = flashbackMediaRefs.current[fb.id] as HTMLAudioElement | null;
                                  if (audio) {
                                    flashbackVolumeRef.current = { volume: audio.volume, muted: audio.muted };
                                    try { localStorage.setItem('mindvault:flashback:volume', JSON.stringify(flashbackVolumeRef.current)); } catch {}
                                  }
                                }}
                                onEnded={() => handleFlashbackMediaEnded(fb.id)}
                                onPause={() => handleFlashbackMediaPause(fb.id)}
                                onPlay={() => handleFlashbackMediaPlay(fb.id)}
                              />
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {fb.content && (() => {
                        const isMediaRef = fb.content.startsWith('media://');
                        const isFilePath = fb.mediaFilePath && fb.content === fb.mediaFilePath;
                        const showText = fb.type === 'text' || fb.type === 'link' || (!isMediaRef && !isFilePath && fb.content.trim());
                        if (!showText) return null;
                        return (
                          <p style={{
                            fontSize: '13px', color: 'var(--text-secondary)',
                            lineHeight: '1.7',
                            margin: 0,
                          }}>{isMediaRef ? '' : fb.content}</p>
                        );
                      })()}
                      {(fb.isFavorite || (fb as any).is_favorite === 1) && <FavoriteBadge size={28} />}
                    </motion.div>
                  );
                })() : (
                  <div>
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '14px',
                    }}>
                      <div style={{
                        width: '64px', height: '64px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--primary-bg), color-mix(in srgb, var(--primary-color) 20%, transparent))',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '12px',
                        boxShadow: 'var(--shadow-raised)',
                      }}>
                        <Sparkles size={28} color="var(--primary-color)" />
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {flashbackLoading ? <><Spinner size={16} color="var(--primary-color)" /> 加载中...</> : '还没有创意，快去记录吧'}
                      </p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
              {/* 轮播指示点 */}
              {flashbacks.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
                  {flashbacks.map((fb, idx) => (
                    <motion.button
                      key={fb.id}
                      onClick={() => {
                        const oldFb = flashbacks[activeFlashbackIndex];
                        if (oldFb) {
                          const mediaEl = flashbackMediaRefs.current[oldFb.id];
                          if (mediaEl && !mediaEl.paused) {
                            flashbackPlayingState.current[oldFb.id] = {
                              playing: true,
                              currentTime: mediaEl.currentTime,
                            };
                            flashbackProgrammaticPauseRef.current[oldFb.id] = true;
                            mediaEl.pause();
                          }
                        }
                        setActiveFlashbackIndex(idx);
                        activeFlashbackIndexRef.current = idx;
                        const newFb = flashbacks[idx];
                        if (newFb && (newFb.type === 'video' || newFb.type === 'audio')) {
                          tryPlayActiveMedia(newFb.id);
                        }
                        if (!document.hidden) {
                          scheduleFlashbackSwitch(idx);
                        }
                      }}
                      animate={{
                        width: idx === activeFlashbackIndex ? '20px' : '8px',
                        background: idx === activeFlashbackIndex ? 'var(--primary-color)' : 'var(--border-light)',
                      }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{
                        height: '4px',
                        borderRadius: '2px',
                        border: 'none',
                        opacity: idx === activeFlashbackIndex ? 1 : 0.6,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
        </div>

        {/* 最近创意 - 用Ant Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Popover content="聪明人通常会用无线鼠标控制笔工作✏️" trigger="hover">
                <div className="keycap-hover-anim home-icon-btn" style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...keycapStyle,
                }}>
                  <DesignProcessMousePenIcon size={16} />
                </div>
                </Popover>
                <span style={{ fontFamily: 'var(--font-title)' }}>最近创意</span>
              </div>
            }
            extra={
              <motion.div whileHover={{ y: 2, transition: { type: 'spring', stiffness: 400, damping: 15, mass: 0.5 } }} style={{ display: 'inline-block' }}>
              <Button 
                type="text" 
                size="small" 
                onClick={() => navigate('/search')}
                style={{
                  borderWidth: '1px 1px 2px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(255, 255, 255, 0.15) rgba(0, 0, 0, 0.08) rgba(0, 0, 0, 0.12) rgba(255, 255, 255, 0.1)',
                  boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.1) 0px 1px 0px inset',
                  borderRadius: 9999,
                }}
              >
                查看全部 <ArrowRight size={14} style={{ marginLeft: '4px' }} />
              </Button>
              </motion.div>
            }
            style={{ height: flashbackHeight ?? '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}
            className="home-card-scrollable"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: '200px' }}>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} active avatar paragraph={{ rows: 1, width: '80%' }} title={{ width: '60%' }} />
                ))
              ) : creativities.length > 0 ? (
                creativities.slice(0, 8).map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 10px', borderRadius: '6px',
                      cursor: 'grab',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0, 0, 0, 0.03)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(0,0,0,0.04)',
                    }}
                    onClick={() => { if (justDraggedRef.current) return; }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    onMouseDown={(e) => handleItemDragStart(e, item)}
                  >
                    <HomeThumbnail
                      type={item.type}
                      content={item.content}
                      mediaFilePath={item.mediaFilePath}
                      thumbnailPath={item.thumbnailPath}
                      size={38}
                      iconSize={16}
                      iconColor="var(--text-secondary)"
                      bg="var(--bg-tertiary)"
                      style={{ borderRadius: '4px', ...keycapStyle }}
                      onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{formatRelativeTime(item.updatedAt)}</div>
                    </div>
                    {item.priority > 0 && (
                      <div style={{
                        display: 'flex', gap: '1px',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 179, 0, 0.12)',
                        borderWidth: '1px 1px 2px',
                        borderStyle: 'solid',
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.1) 0px 1px 0px inset',
                      }}>
                        {Array.from({ length: item.priority }).map((_, i) => (
                          <ShootingStar key={i} size={10} fill="#FFB300" color="#FFB300" />
                        ))}
                      </div>
                    )}
                    {(item.isFavorite || (item as any).is_favorite === 1) && <FavoriteBadge size={20} />}
                  </motion.div>
                ))
              ) : (
                <div style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  flex: 1,
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '12px',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-raised)',
                  }}>
                    <Sparkles size={24} color="var(--text-tertiary)" />
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>还没有任何创意</h4>
                  <Button 
                    type="primary" 
                    size="small" 
                    onClick={toggleQuickCapture}
                    style={{ marginTop: '8px' }}
                  >
                    创建第一个创意
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* 最近看板 - 用Ant Card */}
        {recentBoards.length > 0 && (
          <motion.div
            className="home-grid-boards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Popover content="拜托谁都好！带我离开这儿，为什么我的附近总会住着两个神经病..." trigger="hover">
                <div className="keycap-hover-anim home-icon-btn" style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...keycapStyle,
                }}>
                    <StreamlineJigsawIcon size={16} />
                  </div>
                  </Popover>
                  <span style={{ fontFamily: 'var(--font-title)' }}>最近创意库</span>
                </div>
              }
              style={{ height: flashbackHeight ?? '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}
              className="home-card-scrollable"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {recentBoards.map((board: any, index: number) => (
                  <div
                    key={board.id}
                    onContextMenu={(e) => handleBoardContextMenu(e, board)}
                  >
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + index * 0.05 }}
                    whileHover={{ backgroundColor: 'var(--primary-bg)', x: 4 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '8px',
                      backgroundColor: 'var(--bg-tertiary)',
                      cursor: 'pointer', width: '100%',
                      textAlign: 'left',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(0,0,0,0.1) rgba(255,255,255,0.06) rgba(255,255,255,0.06) rgba(0,0,0,0.1)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(0,0,0,0.06)',
                    }}
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    <motion.div whileHover={keycapHover} className="keycap-hover-anim home-icon-btn-success" style={{
                      width: '36px', height: '36px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      ...keycapStyle,
                    }}>
                      <BoardIcon board={board} size="small" />
                    </motion.div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-title)' }}>{board.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{formatRelativeTime(board.updatedAt)}</div>
                    </div>
                    <motion.div whileHover={{ y: 2, transition: { type: 'spring', stiffness: 400, damping: 15, mass: 0.5 } }} style={{
                      width: '24px', height: '24px', borderRadius: '4px',
                      background: 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      borderWidth: '1px 1px 2px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(0, 0, 0, 0.06)',
                      boxShadow: 'rgba(0, 0, 0, 0.06) 0px 2px 0px, rgba(255, 255, 255, 0.07) 0px 1px 0px inset',
                    }}>
                      <ArrowRight size={14} color="var(--text-tertiary)" />
                    </motion.div>
                  </motion.div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* 数据统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <StatsDashboard stats={stats} isLoading={!stats} />
      </motion.div>

      {/* 创意详情弹窗 */}
      {previewOpen && previewItem && (
        <CardPreview
          creativity={previewItem}
          isOpen={previewOpen}
          onClose={handleClosePreview}
          onSave={handleSaveCreativity}
          onDelete={() => fetchCreativities({ page: 1, pageSize: 10 })}
          relatedCreativities={creativities.filter(c => c.id !== previewItem.id).slice(0, 3)}
          onRelatedClick={handleItemClick}
          onEdit={() => {
            setPreviewOpen(false);
            useUIStore.getState().openEditor(previewItem);
          }}
        />
      )}

      {directImagePreview && (
        <AntImage
          style={{ display: 'none' }}
          src={toMediaUrl(directImagePreview.mediaFilePath || directImagePreview.content)}
          preview={{
            visible: true,
            zIndex: 60,
            onVisibleChange: (visible: boolean) => { if (!visible) setDirectImagePreview(null); },
          }}
        />
      )}

      {/* 右键菜单 - 用Ant风格美化 */}
      {contextMenu && (
        <div ref={contextMenuRef} style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 1000,
          minWidth: '160px',
        }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}>
          <Menu
            mode="vertical"
            onClick={({ key }) => handleContextAction(key)}
            style={{ border: 'none', background: 'transparent' }}
            items={[
              { key: 'edit', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Pencil size={14} />编辑</span> },
              { key: 'favorite', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CollectionIcon size={14} />{(contextMenu.item.isFavorite || (contextMenu.item as any).is_favorite === 1) ? '取消收藏' : '收藏'}</span> },
              { type: 'divider' },
              // 添加发送到画布子菜单（如果有画布）
              ...(boards.length > 0 ? [
                { 
                  key: 'send-to-board', 
                  label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Send size={14} />发送至画布</span>, 
                  children: boards.map((board: any) => ({
                    key: `board-${board.id}`,
                    label: board.name,
                  })),
                },
                { type: 'divider' },
              ] : []),
              { key: 'ai-discuss', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary-color)' }}><MessageSquare size={14} />发送给 AI 讨论</span> },
              { key: 'ai-continue', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary-color)' }}><PenLine size={14} />AI 续写</span> },
              { key: 'ai-rewrite', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary-color)' }}><Sparkles size={14} />AI 润色改写</span> },
              { key: 'ai-tags', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary-color)' }}><Tags size={14} />AI 生成标签</span> },
              { key: 'ai-translate', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary-color)' }}><Languages size={14} />AI 翻译</span> },
              { type: 'divider' },
              { key: 'trash', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Trash2 size={14} />移到回收站</span>, danger: true },
            ]}
          />
        </div>
        </div>
      )}

      {/* 城市选择器 */}
      <CitySelector
        visible={citySelectorVisible}
        onClose={() => setCitySelectorVisible(false)}
        onSelect={handleCitySelect}
        currentCity={currentCity}
      />

      {/* 天气详情面板 */}
      <AnimatePresence>
        {weatherDetailVisible && (
          <motion.div
            key="weather-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.4)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setWeatherDetailVisible(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 380, maxHeight: '80vh', overflow: 'auto',
                background: 'var(--bg-primary)', borderRadius: 16,
                padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-light)',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              className="hide-scrollbar"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>天气详情</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setWeatherDetailVisible(false)}
                  style={{ border: 'none', background: 'var(--bg-tertiary)', borderRadius: 6, cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)' }}
                >
                  <X size={14} />
                </motion.button>
              </div>
              <WeatherDetailPanel />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 明日天气预报通知 */}
      <AnimatePresence>
        {forecastNotification.visible && forecastNotification.forecast && (
          <WeatherNotification
            type="forecast"
            forecast={forecastNotification.forecast}
            visible={true}
            onClose={() => setForecastNotification({ ...forecastNotification, visible: false })}
            onClick={async () => {
              setForecastNotification({ ...forecastNotification, visible: false });
              if (forecastNotification.notificationId) {
                useNotificationStore.getState().openCenterWithHighlight(
                  forecastNotification.notificationId, 
                  'weather'
                );
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 天气预警通知 */}
      <AnimatePresence>
        {alertNotification.visible && alertNotification.alert && (
          <WeatherNotification
            type="alert"
            alert={alertNotification.alert}
            visible={true}
            onClose={() => setAlertNotification({ ...alertNotification, visible: false })}
            onClick={async () => {
              setAlertNotification({ ...alertNotification, visible: false });
              if (alertNotification.notificationId) {
                useNotificationStore.getState().openCenterWithHighlight(
                  alertNotification.notificationId, 
                  'weather'
                );
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 完整天气播报弹窗（点击通知后展开） */}
      {briefingVisible && briefingData && (
        <WeatherBriefing
          type={briefingMode}
          briefing={briefingData}
          visible={briefingVisible}
          onClose={() => setBriefingVisible(false)}
        />
      )}

      {/* 创意库右键菜单 */}
      {contextMenuBoard && createPortal(
        <div
          ref={boardContextMenuRef}
          style={{
            position: 'fixed',
            left: Math.min(contextMenuPos.x, window.innerWidth - 200),
            top: Math.min(contextMenuPos.y, window.innerHeight - 300),
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '6px 0',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            minWidth: 180,
          }}
        >
          <div
            onClick={() => handleBoardMenuAction('duplicate')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Copy size={14} />
            <span>创建副本</span>
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />
          <div
            onClick={() => handleBoardMenuAction('change-icon')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Image size={14} />
            <span>更换图标</span>
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setStatusSubmenuOpen(true)}
            onMouseLeave={() => setStatusSubmenuOpen(false)}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleCheck size={14} />
                <span>设置项目状态</span>
              </div>
              <ChevronRight size={12} style={{ opacity: 0.5 }} />
            </div>
            {statusSubmenuOpen && (
              <div style={{
                position: 'absolute', left: '100%', top: -6,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10, padding: '4px 0',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                minWidth: 140, zIndex: 100000,
              }}>
                {[
                  { key: 'status:active', Icon: CircleCheck, label: '进行中', active: !contextMenuBoard.projectStatus || contextMenuBoard.projectStatus === 'active' },
                  { key: 'status:paused', Icon: CirclePause, label: '已暂停', active: contextMenuBoard.projectStatus === 'paused' },
                  { key: 'status:completed', Icon: CircleCheckBig, label: '已完成', active: contextMenuBoard.projectStatus === 'completed' },
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => handleBoardMenuAction(item.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 13, borderRadius: 6, margin: '0 4px',
                      color: item.active ? 'var(--primary-color)' : 'var(--text-primary)',
                      fontWeight: item.active ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <item.Icon size={14} />
                    <span>{item.label}</span>
                  </div>
                ))}
                <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 8px' }} />
                <div
                  onClick={() => handleBoardMenuAction('status:archived')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
                    fontSize: 13, borderRadius: 6, margin: '0 4px',
                    color: contextMenuBoard.projectStatus === 'archived' ? 'var(--primary-color)' : 'var(--text-primary)',
                    fontWeight: contextMenuBoard.projectStatus === 'archived' ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <Archive size={14} />
                  <span>已归档</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />
          <div
            onClick={() => handleBoardMenuAction('delete')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#dc2626', borderRadius: 6, margin: '0 4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(220,38,38,0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Trash2 size={14} />
            <span>删除</span>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Home;
