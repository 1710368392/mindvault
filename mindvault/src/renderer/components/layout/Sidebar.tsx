import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout, Menu, Button, theme, Popconfirm, Progress, Tooltip, Popover, message, Modal, Input } from 'antd';
import {
  Home,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Palette,
  LucideProps,
  CircleCheck,
  CirclePause,
  CircleCheckBig,
  Archive,
  Image,
  Folder,
  StickyNote,
} from 'lucide-react';
import ShootingStar from '../common/ShootingStar';
import ImageCropper from '../common/ImageCropper';
import BoardIcon from '../common/BoardIcon';
import { api } from '../../utils/api';

const FavoriteIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <ShootingStar size={size} style={style} />
);

const WCIcon: React.FC<LucideProps> = ({ size = 20, ...props }) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    {...props}
  >
    <path d="M41.82 34.893c-3.617.866-7.356 1.213-11.078 1.195c-3.748.01-7.477-.299-11.107-1.126c-1.809-.429-3.595-.981-5.294-1.757c-1.694-.773-3.349-1.724-4.694-3.096c1.047 1.645 2.646 2.863 4.291 3.887c1.673 1 3.479 1.768 5.337 2.334c3.719 1.152 7.618 1.553 11.456 1.576c3.865-.019 7.753-.459 11.462-1.65a25.4 25.4 0 0 0 5.319-2.365c1.647-1.018 3.241-2.209 4.383-3.781c-1.423 1.287-3.082 2.221-4.784 2.992c-1.704.773-3.486 1.343-5.291 1.791" fill="currentColor" />
    <path d="M56.576 11.458c-2.033-3.139-11.885-6.51-20.121-8.088C31.91 2.5 26.963 2 22.883 2c-8.718 0-9.181 2.104-9.323 2.752l-.754 2.786q-.05.134-.079.263c-.004.017-.004.04-.007.058l-.03.109a.9.9 0 0 0 .019.488c.041.258.142.552.345.868c1.21 1.867 5.675 3.774 11.054 5.35C15.006 15.973 7 20.02 7 27.236q0 .057.007.115L9.67 48.623c.013 1.978.707 3.854 1.931 5.545l.222 1.188c.553 2.909 7.667 6.393 10.855 5.615C25.172 61.633 27.904 62 30.77 62c11.604 0 21.05-5.996 21.101-13.377l2.661-21.272a1 1 0 0 0 .008-.114c0-3.684-2.089-6.54-5.342-8.628c4.935-.046 6.503-.938 7.024-1.809a.9.9 0 0 0 .185-.394l.013-.078a1 1 0 0 0 .024-.088c.014-.066.022-.145.029-.225l.481-2.842c.124-.561-.004-1.138-.378-1.715M52.75 27.18l-2.662 21.27a1 1 0 0 0-.006.114c0 6.406-8.664 11.618-19.313 11.618c-2.271 0-4.443-.249-6.471-.686c.889-1.75 1.256-4.48 1.256-4.48l-.267-1.438c-6.335-.852-10.03-4.307-10.03-4.307s-1.807 1.399-2.901 2.789c-.582-1.104-.898-2.279-.898-3.497a1 1 0 0 0-.007-.114L8.789 27.18c.053-7.326 10.441-10.838 20.582-11.132q.53.123 1.059.241c-10.533.084-19.018 4.052-19.018 8.934c0 4.936 8.667 8.938 19.357 8.938c10.691 0 19.359-4.002 19.359-8.938c0-2.786-2.763-5.274-7.092-6.913q.926.086 1.811.149c4.483 1.761 7.872 4.569 7.903 8.721m-13.795-1.324c.567-.389 1.152-.785 1.738-1.172c.477-1.48.398-4.025 2.262-4.36c1.144-.206 1.985.563 2.634 1.458c.712-.326 1.222-.465 1.401-.314c.915.769.775 1.918.443 2.875c.504.397 1.156.744 1.783 1.027c-.188 4.287-8.552 7.883-18.447 7.883c-7.3 0-13.756-1.961-16.726-4.708l.027-.017c-.829-1.287-1.526-2.629-1.182-3.083c.67-.878 2.063.02 3.323.929c1.205-2.009.899-3.976 2.966-4.508c.851-.22 1.269.353 1.617 1.182c1.354-.501 3.131-.862 4.672-2.546c.697-.761.779 1.092.703 2.993c.268.015.553.164.847.413c.149-.667.37-1.109.669-1.194c1.46-.417 2.115.977 2.723 2.093c1.873-4.076 2.94-3.378 3.046.165c1.047-.956 2.216-2.095 3.509-1.455c.888.44.703 1.299.204 2.18c.636.09 1.258.164 1.788.159m10.749-9.071c1.119-.183 1.808-.493 1.908-.943c.363-1.639-7.013-4.444-16.474-6.265c-9.463-1.822-17.432-1.969-17.795-.33c-.111.499.503 1.106 1.667 1.76c-2.926-1.201-4.468-2.244-4.545-2.79c.005-.01.665-.972 5.9-.972c4.077 0 9.382.586 14.937 1.651c12.629 2.418 19.24 5.775 19.4 6.927c-.003.01-.589.859-4.998.962m5.359-3.155c-3.246-2.548-11.691-5.039-19.43-6.521c-5.658-1.084-11.081-1.682-15.267-1.682c-2.479 0-4.143.206-5.275.516l.203-.751c.064-.291 1.54-1.374 7.588-1.374c3.974 0 8.801.488 13.242 1.339c9.716 1.861 17.646 5.277 18.957 7.3c.116.179.133.287.117.363z" fill="currentColor" />
  </svg>
);

const PlusCircleIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ ...style, transform: `translateY(2px) ${style?.transform || ''}` }}
  >
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path fill="currentColor" fillOpacity="0" strokeDasharray="60" d="M3 12c0 -4.97 4.03 -9 9 -9c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9Z">
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="60;0" />
        <animate fill="freeze" attributeName="fill-opacity" begin="0.6s" dur="0.15s" to=".3" />
      </path>
      <g fill="none" strokeDasharray="12" strokeDashoffset="12">
        <path d="M7 12h10">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.85s" dur="0.2s" to="0" />
        </path>
        <path d="M12 7v10">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="1.05s" dur="0.2s" to="0" />
        </path>
      </g>
    </g>
  </svg>
);

const HomeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    style={style}
  >
    <path d="M886.2 623.6c-20 0-38.8-8-53-22.5L513 272 192.8 601.1c-14.1 14.5-32.9 22.5-53 22.5-20 0-38.8-8-52.9-22.5-28.8-29.6-28.8-77.8 0-107.4L499.6 69.5c7-7.2 19.7-7.2 26.7 0L939 493.7c28.8 29.6 28.8 77.8 0 107.4-14 14.5-32.8 22.5-52.8 22.5zM513 226.6c5 0 9.9 2 13.4 5.6L860 575c7 7.2 16.3 11.2 26.2 11.2 9.9 0 19.2-4 26.2-11.2 14.8-15.3 14.8-40.1 0-55.3L513 109.3 113.6 519.8c-14.8 15.3-14.8 40.1 0 55.3 7 7.2 16.3 11.2 26.2 11.2 9.9 0 19.2-4 26.2-11.2l333.6-342.8c3.5-3.6 8.4-5.7 13.4-5.7z" fill="var(--text-primary)" />
    <path d="M830.2 959.5H606.3c-10.3 0-18.7-8.3-18.7-18.7V698.3H438.4v242.6c0 10.3-8.3 18.7-18.7 18.7H195.8c-10.3 0-18.7-8.3-18.7-18.7V571.3c0-4.9 1.9-9.5 5.3-13l317.2-326c3.5-3.6 8.3-5.6 13.4-5.6h0.1c5 0 9.9 2.1 13.4 5.7l317.2 329.3c3.3 3.5 5.2 8.1 5.2 12.9v366.2c-0.1 10.3-8.4 18.7-18.7 18.7z m-205.3-37.4h186.6v-340l-298.6-310-298.4 306.7v343.3h186.6V679.6c0-10.3 8.3-18.7 18.7-18.7h186.6c10.3 0 18.7 8.3 18.7 18.7v242.5z" fill="var(--text-primary)" />
    <path d="M419.7 777.8v-98.2h186.6v10.9c52.6-51.5 90.9-129.5 97.5-247l-88.2-91.6c-4 14.8-69 230.8-419.8 286.4v130.6s107.6 27.2 223.9 8.9z" fill="var(--primary-color)" />
    <path d="M334.9 802.8c-79.7 0-140.3-15.1-143.7-15.9-8.3-2.1-14.1-9.5-14.1-18.1V638.2c0-9.2 6.7-17 15.7-18.4 341-54 402.3-264 404.7-272.9 1.8-6.5 6.9-11.5 13.4-13.1 6.5-1.7 13.4 0.3 18.1 5.1l88.2 91.6c3.6 3.7 5.5 8.8 5.2 14-6.3 111.3-41 198.5-103.1 259.3-5.4 5.3-13.4 6.8-20.3 3.9-4.4-1.8-7.8-5.2-9.7-9.4h-151v79.5c0 9.2-6.7 17-15.8 18.4-30.3 4.8-60.1 6.6-87.6 6.6z m84.8-25h0.2-0.2z m-205.2-24c30.3 6 105.5 17.8 186.6 7.8v-82c0-10.3 8.3-18.7 18.7-18.7h186.6c0.7 0 1.4 0 2 0.1 44.5-51.6 70.1-122.3 76.3-210.6l-61.9-64.2C593.6 452.6 497.1 604.3 214.5 654v99.8z" fill="var(--text-primary)" />
  </svg>
);

export const PuzzleNavIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="currentColor" fillOpacity="0.85" d="m22.252 12.657l-.25-.6a.53.53 0 0 0-.539-.309c-.32.05-.649.17-.999.2a.42.42 0 0 1-.379-.22a.44.44 0 0 1 0-.439q.2-.368.51-.649c.08-.08.309-.27.439-.42a.74.74 0 0 0 .2-.459a.84.84 0 0 0-.05-.36c0-.129-.17-.309-.19-.389l-.59-1.208a5 5 0 0 0-.329-.56a.7.7 0 0 0-.4-.259a.9.9 0 0 0-.389 0c-.12 0-.3.15-.37.18l-.928.44c-.09-.1-.18-.18-.2-.2a1.9 1.9 0 0 0-.798-.51a2.2 2.2 0 0 0-.92-.09c-.53.058-1.016.32-1.357.73a1.9 1.9 0 0 0-.45 1.447a2.2 2.2 0 0 0 .19.61l-.38.16l-.598.289c-.52.45-.3.928.26.709l.628-.25c.18-.06.42-.1.63-.17q.184-.063.349-.17a.51.51 0 0 0 .12-.608c0-.06-.11-.21-.11-.22l-.12-.44a1 1 0 0 1 .26-.679a1 1 0 0 1 .669-.23a1 1 0 0 1 .42.08a.8.8 0 0 1 .299.22s.21.36.29.48a.72.72 0 0 0 .588.35a.9.9 0 0 0 .34-.13l.32-.19l.888-.35l.55 1.079l.05.15l-.17.12c-.36.378-.618.842-.75 1.347a1.45 1.45 0 0 0 .3 1.229a1.39 1.39 0 0 0 1.059.599c.317-.014.63-.074.928-.18c.08.12.19.24.19.25c.2.389.43.778.63 1.168c.05.11.089.23.139.34c-.19.09-.37.189-.57.269c-.409.17-.838.27-1.257.41c-.42.14-.86.339-1.268.509l-1.518.928l-.999.49a.45.45 0 0 0 .37.818c.9-.27 1.782-.603 2.636-.998c.29-.12.589-.23.879-.37c.289-.14.599-.3.878-.459a10 10 0 0 0 .859-.62l-.06 1.11c0 .678 0 .868-.849 1.467q-.93.565-1.927.999c-.56.3-1.158.559-1.747.809c-.31.14-.64.27-.999.399c0-.25.09-1.288-.36-1.288s-.778.25-.649 1.078c.05.33.1.22.21.54l-2.496.998c-.919.39-1.768.859-2.676 1.228q-.555.23-1.139.38a.384.384 0 0 0 .17.749a9 9 0 0 0 1.278-.37c.939-.3 1.828-.699 2.756-.998c1.259-.44 2.547-.82 3.775-1.309a20.5 20.5 0 0 0 2.456-1.188a15 15 0 0 0 1.997-1.258a3.6 3.6 0 0 0 .999-1.328a.7.7 0 0 0 .08-.34c0-.22-.1-.529-.11-.679c-.07-3.035.769-.479-.7-3.864"/>
      <path fill="currentColor" fillOpacity="0.85" d="M8.432 23.142a3 3 0 0 1-1.348-1.178a20 20 0 0 1-1.338-2.786c-.24-.52-.46-1.049-.68-1.578c-.359-.799-1.477-3.625-1.507-3.715c-.28-.689-.609-1.368-.879-2.057c-.11-.28-.22-.559-.32-.849c-.099-.29-.249-.818-.349-1.238a7 7 0 0 1-.18-.759a1.3 1.3 0 0 1 .33-1.258c.18-.25.38-.48.58-.709q.141 1.235.419 2.447c.2.888.529 1.577.799 2.476c.1.32.13.48.31.949a.55.55 0 0 0 .998-.36c-.15-.39-.19-.519-.31-.809A36 36 0 0 1 3.86 8.723c-.18-.74-.36-1.428-.5-2.137c0 0 0-.06-.06-.1c1.209-.44 2.407-.999 3.625-1.428a13 13 0 0 1 1.648-.5q.553-.27 1.148-.429c.1.19.25.46.37.74q.172.357.24.748c0 .12 0 0 0 0a1.7 1.7 0 0 1-.24.32a3.1 3.1 0 0 0-.56.819a1.35 1.35 0 0 0 0 1.098c.139.398.392.746.73.999a1.68 1.68 0 0 0 1.238.29h.19a.3.3 0 0 0 0 .099l.329.829c.3.519.859.05.769-.37l-.25-.779a6 6 0 0 0-.22-.639a.51.51 0 0 0-.399-.3a.65.65 0 0 0-.29 0c-.08 0-.37.07-.36.17a.65.65 0 0 1-.369-.17a1.1 1.1 0 0 1-.3-.478a.3.3 0 0 1 0-.25q.224-.327.52-.59c.218-.23.376-.511.46-.818a2 2 0 0 0-.15-.999a9.5 9.5 0 0 0-.72-1.507a.79.79 0 0 0-.788-.35q-.856.16-1.688.42a13 13 0 0 0-1.717.698c-1.268.57-2.507 1.289-3.735 1.878l-.22.15c-.329.339-.688.689-.998 1.068q-.34.399-.61.849a.9.9 0 0 0-.079.33c0 .219.05.538.05.668c0 .31.06.61.12.919s.16.869.25 1.308q.15.662.389 1.298c.22.6.47 1.198.699 1.797c.43 1.089.849 2.177 1.318 3.246c.33.719.689 1.428 1.068 2.117c.455.98.99 1.922 1.598 2.816a3.74 3.74 0 0 0 1.887 1.368a.36.36 0 0 0 .39-.14a.35.35 0 0 0 .21.1a.37.37 0 0 0 .399-.36q.168-.675.23-1.368c-.27-.52-.56-.689-.999-.31c-.103.426-.12.867-.05 1.299"/>
      <path fill="currentColor" fillOpacity="0.95" d="m11.608 1.743l.279.36c.1.11.2.22.31.319c.998.998.998.998 1.258.909c.45-.22-.2-1.518-.28-1.658a2 2 0 0 0-.33-.44a2.3 2.3 0 0 0-.399-.359C11.138-.124 10.91.215 10.82.355s-.04.36.789 1.388m3.913 1.248c.11 0 .32.11.838-.998q.081-.158.12-.33c0-.11 0-.22.06-.33c.1-1.058.14-1.198-.13-1.318c-.11 0-.429-.22-.998.999a1.4 1.4 0 0 0-.14.36q-.057.18-.07.369s-.05 1.248.32 1.248m3.694.999c.15-.07.29-.15.43-.23l.429-.27c1.168-.769 1.398-.818 1.268-1.178c-.06-.15-.15-.47-1.797.08a4 4 0 0 0-.54.24a3.3 3.3 0 0 0-.489.34c-.24.219-1.208 1.237-.848 1.577c.359.34.23.13 1.547-.56M15.991 17.21l-.57-1.478c.17-.1.36-.18.37-.19a2.7 2.7 0 0 0 .77-1.058a1.8 1.8 0 0 0 .089-.998a1.5 1.5 0 0 0-.659-.999a2.28 2.28 0 0 0-1.488-.35l-.579.12l-.13-.16l-.629-1.118s-.18-.569-.35-.619c-.479-.14-1.387.71-1.767.939q-.222.135-.46.24c-.089 0-.498.15-.658.23a.58.58 0 0 0-.25.289a.7.7 0 0 0 0 .27c0 .15.13.449.13.569c.016.253-.029.506-.13.739a.86.86 0 0 1-.4.439a.41.41 0 0 1-.399 0a2 2 0 0 1-.569-.48q-.23-.285-.5-.539a1 1 0 0 0-.568-.21a2 2 0 0 0-.42.07c-.36.08-.729.27-1.068.31h-.13c-.32-.13-1.178.45-1.058.789c0 .07.998 2.377 1.348 3.195c.26.65.519 1.288.799 1.918q.286.727.718 1.378q.271.332.63.569a3 3 0 0 0 2.566.13a13.6 13.6 0 0 0 1.997-.72q.93-.451 1.807-.998c.25-.15.72-.34 1.079-.57c0 .08.689-.409.749-.648a1.8 1.8 0 0 0-.27-1.059m-.929-2.516s-.449.3-.599.42a.64.64 0 0 0-.25.668l.58 1.788l.1.18l-.2.11c-.34.19-.759.359-.999.489c-.549.33-1.108.639-1.697.918a13 13 0 0 1-1.768.69c-.293.1-.599.164-.908.19a1.6 1.6 0 0 1-.78-.13a1.1 1.1 0 0 1-.399-.37a8 8 0 0 1-.579-.999a48 48 0 0 1-1.128-2.276c-.36-.77-.55-1.239-.819-1.868h.21c1.837-.479 1.158-.37 1.528 0c.33.366.75.641 1.218.8a1.48 1.48 0 0 0 1.188-.13a1.82 1.82 0 0 0 .759-.82c.22-.455.303-.965.24-1.467a.7.7 0 0 0-.13-.25c.14-.07.29-.19.33-.21q.278-.15.539-.33c.31-.219.609-.468.928-.688l.6 1.188q.085.259.229.49a.53.53 0 0 0 .31.19q.204.03.409 0c.2 0 .43-.1.61-.11c.246-.015.491.04.708.159a.59.59 0 0 1 .33.41a.82.82 0 0 1-.11.519q-.186.253-.44.439z"/>
    </g>
  </svg>
);

export const PuzzleBoardIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={style}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="currentColor" fillOpacity="0.95" d="M16 12.038c0-.39-.26-.53-.37-.73c-.24-.46-.77-.89-.62-1.24c.24-.53 1-.64 1.57-.5q.6.278 1.23.48c.37.06.66-.31 1-.72a5.2 5.2 0 0 0 1.06-1.81a.56.56 0 0 0-.08-.33a9.4 9.4 0 0 0-2.09-1.65s-.14-.14-.24-.21a3.6 3.6 0 0 0 .42-1.74a2.38 2.38 0 0 0-4-1.48c-.51.57.34.87.41.38l.32-.25a1.76 1.76 0 0 1 2.59 1.66a3.9 3.9 0 0 1-.48 1.29c-.39.8.49.66 2.3 2.36a6 6 0 0 1-1.17 1.51l-1-.42a2.31 2.31 0 0 0-2.76 1c-.46 1 .28 1.53.62 2.18c.22.44.35.14 0 .82a7.2 7.2 0 0 1-1 1.48c-1-.32-6.5-3.23-7.16-4.34a5.6 5.6 0 0 1 1-2c1.13.6 1.81 1.11 2.84.52c2.1-1.22 1.42-3.62-.95-4a8.6 8.6 0 0 1 1-1.72c.25-.27 1.26.23 1.56.38a.324.324 0 1 0 .29-.58c-2.23-1.2-2.29-.56-3.52 1.6c-.16.28-.36.59-.13.87s.92.21 1.18.3c.7.25 1.28.94.92 1.59c-.24.42-.83.94-1.32.87c-2-.85-1.89-1.5-2.8-.17a4.86 4.86 0 0 0-1 2.37c0 1.79 7.75 5.39 8.25 5.41c.88.05 2.13-2.62 2.13-3.18"/>
      <path fill="currentColor" fillOpacity="0.85" d="M8.71 19.548c-.32-1.39.26-5.08-1.38-5.05c-1.46 0-1.18 1.19-1.7 2.6c-.14.39-.12.43-1-.38a3.5 3.5 0 0 1-.45-.56c.08-.39-.08-.1.22-2.6c.11-.89.07-1.93-.72-2.35a1.3 1.3 0 0 0-1.55.22a1.09 1.09 0 0 0-1.07-.45C0 11.098 0 12.318 0 13.348c.06 2.74 2.2 5.68 4.24 7.51l.62 1.58c.09.27.67-.05.57-.32L5 20.448c0-.13-4.23-3.48-4.19-7.11c0-.41 0-1.52.38-1.56c.58-.06.47.46 1.27 2.55a12.5 12.5 0 0 0 1.09 2.25a4.34 4.34 0 0 0 1.78 1.5c1.25.23 1.08-1.82 1.46-2.4c.09-.15.26-.22.54-.23c1 0 .22 4.36.88 4.65c.23.11.69-.21.54-.41c.02-.02-.03-.08-.04-.14m-6.3-7.65a.71.71 0 0 1 .95-.1c.4.27.31 1.25.27 1.8a7 7 0 0 0 .05 1.61a33 33 0 0 1-1.27-3.31m12.84 7.79c-.15.2.31.52.54.41c.66-.29-.09-4.69.88-4.65c.28 0 .45.08.54.23c.38.58.21 2.63 1.46 2.4a4.34 4.34 0 0 0 1.78-1.5c.452-.71.83-1.463 1.13-2.25c.8-2.09.69-2.61 1.27-2.55c.41 0 .38 1.15.38 1.56c0 3.63-4.14 7-4.19 7.11l-.47 1.67c-.1.27.48.59.57.32l.62-1.58c2-1.83 4.18-4.77 4.24-7.51c0-1 0-2.25-1.06-2.37a1.09 1.09 0 0 0-1.1.45a1.3 1.3 0 0 0-1.55-.22c-.79.42-.83 1.46-.72 2.35c.3 2.5.14 2.21.22 2.6a3.5 3.5 0 0 1-.45.56c-.88.81-.86.77-1 .38c-.52-1.41-.24-2.6-1.7-2.6c-1.64 0-1.06 3.66-1.38 5.05c0 .06-.06.12-.04.14m6.3-7.65a33 33 0 0 1-1.27 3.31a7 7 0 0 0 .05-1.61c0-.55-.13-1.53.27-1.8a.71.71 0 0 1 .95.1"/>
    </g>
  </svg>
);

const SearchIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={style}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="var(--primary-color)" d="M22 2.667s-.07-.1-.13-.12a1.7 1.7 0 0 1-.61-.45a1.7 1.7 0 0 1-.33-.66C20.66.439 20.82.349 20.46.12a.59.59 0 0 0-.71 0c-.147.112-.263.26-.339.43c-.14.27-.22.729-.32.909c-.11.276-.293.518-.53.7a2.8 2.8 0 0 1-.938.399a.33.33 0 0 0-.28.36a.32.32 0 0 0 .36.28a.35.35 0 0 0 .19.24c.245.14.47.316.669.519c.174.177.31.388.4.62l.19.589l.1.24a.67.67 0 0 0 1.068.23a1.3 1.3 0 0 0 .23-.42c.06-.18.08-.4.14-.54c.086-.395.276-.76.55-1.06c.176-.194.405-.333.66-.399a.31.31 0 0 0 .279-.35a.29.29 0 0 0-.18-.2m-1.52.46a2.9 2.9 0 0 0-.67.769q-.209-.27-.479-.48a4 4 0 0 0-.64-.34a3.3 3.3 0 0 0 .55-.2c.334-.185.621-.445.84-.759c.15.239.34.451.56.63q.13.073.269.13a3 3 0 0 0-.43.25"/>
      <path fill="var(--text-primary)" d="M20.45 14.877a11.8 11.8 0 0 0-1.529-2.298a.36.36 0 0 0-.51 0a.36.36 0 0 0-.049.51q.561.723 1 1.528q.306.531.479 1.12c0 .09.06.16 0 .21a1.87 1.87 0 0 1-1 .739c-.2.07-1.998.28-2.248.3c-1.389.12-2.818.14-4.256.14h-1.58c-1.628 0-3.277 0-4.845-.12c-.21 0-.5 0-.79-.08c0 0-1.179-.26-1.369-.34a1.52 1.52 0 0 1-.919-.76a1.65 1.65 0 0 1 .15-.999c.25-.65.65-1.309.84-1.718q.37.126.759.19q.184.015.37 0l.36-.06c1.138-.22 1.228-.31 1.238-.55s.08-.41-1.269-.6a1.6 1.6 0 0 0-.38 0a3 3 0 0 0-.38 0q-.257.047-.509.12c-.11-.46-.21-.92-.33-1.389c-.06-.22-.12-.44-.2-.65a4.4 4.4 0 0 0-.25-.629a10 10 0 0 0-.539-.999c.92 0 1.829-.09 2.728-.09c1.23 0 2.428.05 3.637.08s2.428 0 3.657 0s2.588 0 3.907-.09c.82 0 1.61-.09 2.388-.17q-.337.537-.61 1.11c-.069.17-.129.34-.189.519c-.06.18-.08.36-.11.55c-.07.43-.1.849-.15 1.269c-.23-.05-.46-.1-.7-.13a2 2 0 0 0-.419 0h-.42c-1.339.24-1.279.43-1.279.55s0 .409 1.29.619q.213.021.43 0l.419-.05c.34-.06.64-.16.999-.23a.37.37 0 0 0 .36-.37v-.08c0-.03.07-.06.09-.11c.19-.4.39-.779.55-1.179q.112-.255.2-.52q.078-.266.129-.539c.07-.44.07-.86.12-1.309a.31.31 0 0 0-.13-.33a.5.5 0 0 0 .07-.21a.36.36 0 0 0-.39-.33h-2.578c-1.289 0-2.578-.119-3.807-.179a2 2 0 0 0 0-.26q-.06-.293-.18-.57a2 2 0 0 0-1.698-1.218a2.14 2.14 0 0 0-1.839.74c-.197.243-.35.52-.45.818a5 5 0 0 0-.08.52H7.47c-1.76.079-3.515.256-5.255.53a.4.4 0 0 0-.19 0a.33.33 0 0 0-.19.41c.1.539.16 1.058.29 1.598q.077.331.2.65c.08.22.17.43.27.639c.23.48.489.93.749 1.389v.05q-.64 1.012-1.12 2.108a2.2 2.2 0 0 0-.21 1.2c0 .649-.11 1.388-.09 2.168q.021.473.1.939a8 8 0 0 0 1.14 2.998a.362.362 0 1 0 .64-.34a6 6 0 0 1-.31-1.1c-.08-.37-.12-.759-.18-1.158c-.06-.4-.1-.78-.17-1.17s-.13-.819-.24-1.259q.225.181.48.32a20 20 0 0 0 2.468.68c.999.09 1.998.16 2.997.22v.629c.018.29.086.573.2.84a2.19 2.19 0 0 0 1.999 1.208a2.55 2.55 0 0 0 1.998-1.049c.186-.243.31-.527.36-.83q.037-.374 0-.749c1.119 0 2.228-.11 3.317-.23a10.6 10.6 0 0 0 2.468-.469c.1 0 .18-.11.27-.15c-.07.27-.15.54-.2.82q-.105.705-.12 1.418v2.129a.36.36 0 0 0 .195.35a.37.37 0 0 0 .535-.291c.13-.669.27-1.338.38-1.998c.05-.29.08-.57.12-.86c.04-.289.05-.579.07-.868c0-.55 0-1.08.07-1.62l.09-.1a1.8 1.8 0 0 0-.15-1.528M10.01 6.803a1.16 1.16 0 0 1 1.748.21q.124.175.21.37H9.499c.12-.232.294-.432.51-.58m2.587 11.831a1.45 1.45 0 0 1-.32.55a1.7 1.7 0 0 1-1.218.48a1.21 1.21 0 0 1-1.09-.5a1.6 1.6 0 0 1-.26-.6v-.32c.54 0 1.09.06 1.64.07h1.348q-.056.166-.14.32z"/>
      <path fill="var(--primary-color)" d="M5.642 15.846c.42-.54-.73-.24 2.358-.36l1.37-.18c.05.07.199.13.239.18l1 1.12c.319.45.879.31 1.368.1c.42-.86.4-1.29.82-1.3q1.051.104 2.108.08l1.369-.18c0 .07.2.13.24.18l.799 1.1c.24.18.85.05.72-.22l-.74-1.479a3 3 0 0 0-.38-.48a.84.84 0 0 0-.33-.16a2 2 0 0 0-.609-.06c-.3 0-.6 0-.89.06a.33.33 0 0 0 0-.33c-.31-.439-.539-1.058-.849-1.578a2.7 2.7 0 0 0-.58-.72a1 1 0 0 0-.459-.16h-.76l-1.598-.06h-1.1q-.504.012-.998.12a1 1 0 0 0-.46.28a4 4 0 0 0-.53 1.1c-.15.46-.26.929-.36 1.349a7 7 0 0 0-1.128 0a3 3 0 0 0-.87.24a.6.6 0 0 0-.29.25a5 5 0 0 0-.24.639l-.23.72c0 .359.57.559.75.269zm2.838-2.588q.18-.36.44-.67c0 .06.18 0 .27 0h3.157c.48 0 .47-.459.999.27c.36.45.65 1 1 1.39a10 10 0 0 0-1.31 0a3 3 0 0 0-.87.24a.6.6 0 0 0-.289.25c-.09.16-.21.549-.25.639l-.43.65l-.809-1.19a2.5 2.5 0 0 0-.38-.43a.9.9 0 0 0-.33-.16a2 2 0 0 0-.609-.06c-.35 0-.71.06-.999.07q.18-.51.41-.999"/>
      <path fill="var(--text-primary)" d="M18.592 22.661q-.74.116-1.489.11c-.77 0-1.539 0-2.318-.05h-1.779l-2.528.07H8.81c-.91 0-1.859.13-2.808.08a6.1 6.1 0 0 1-1.749-.34a.32.32 0 0 0-.42.17a.32.32 0 0 0 .16.42c.606.29 1.253.482 1.919.57q1.41.225 2.838.309h2.438c1.209 0 2.418-.15 3.617-.22c.8-.05 1.569-.07 2.348-.15a11 11 0 0 0 1.589-.25a.364.364 0 0 0 .28-.43a.36.36 0 0 0-.289-.28a.4.4 0 0 0-.141.001zM3.084 7.533q.292-.673.69-1.29c.156-.24.356-.45.589-.619a4.63 4.63 0 0 1 2.448-.69c1.439-.099 3.018.08 4.197.08a36 36 0 0 1 3.847-.169a3.9 3.9 0 0 1 2.188.68a3.2 3.2 0 0 1 .5.47q.34.431.63.898a.37.37 0 0 0 .529.12a.37.37 0 0 0 .12-.5a8 8 0 0 0-.64-.999a3.1 3.1 0 0 0-.58-.63a4.8 4.8 0 0 0-2.598-1.098a33 33 0 0 0-3.996 0a42 42 0 0 0-4.297.07a5.33 5.33 0 0 0-2.868 1.099c-.29.25-.53.551-.71.89q-.376.688-.639 1.428a.32.32 0 0 0 .414.428a.33.33 0 0 0 .176-.168"/>
    </g>
  </svg>
);

import { useUIStore } from '../../stores/uiStore';
import { useBoardStore } from '../../stores/boardStore';
import { useTheme, useThemeOptions } from '../../hooks/useTheme';
import { APP_NAME } from '@shared/constants';
import { playSound, playPianoNote, playKeyPressSound } from '../../utils/sound';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCreativityStore } from '../../stores/creativityStore';
import { registerMediaPaths } from '../../utils/media';

interface FloatingNote {
  id: number;
  symbol: string;
  noteName: string;
  x: number;
  y: number;
  color: string;
}

const NOTE_COLORS = [
  'var(--primary-color)',
  '#FF6B9D',
  '#C084FC',
  '#60A5FA',
];

// 默认创意库图标（脑洞图标）
const DefaultBoardIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ flexShrink: 0 }}
  >
    <g fill="none" fillRule="evenodd" clipRule="evenodd">
      <path fill="currentColor" fillOpacity="0.9" d="M16 12.038c0-.39-.26-.53-.37-.73c-.24-.46-.77-.89-.62-1.24c.24-.53 1-.64 1.57-.5q.6.278 1.23.48c.37.06.66-.31 1-.72a5.2 5.2 0 0 0 1.06-1.81a.56.56 0 0 0-.08-.33a9.4 9.4 0 0 0-2.09-1.65s-.14-.14-.24-.21a3.6 3.6 0 0 0 .42-1.74a2.38 2.38 0 0 0-4-1.48c-.51.57.34.87.41.38l.32-.25a1.76 1.76 0 0 1 2.59 1.66a3.9 3.9 0 0 1-.48 1.29c-.39.8.49.66 2.3 2.36a6 6 0 0 1-1.17 1.51l-1-.42a2.31 2.31 0 0 0-2.76 1c-.46 1 .28 1.53.62 2.18c.22.44.35.14 0 .82a7.2 7.2 0 0 1-1 1.48c-1-.32-6.5-3.23-7.16-4.34a5.6 5.6 0 0 1 1-2c1.13.6 1.81 1.11 2.84.52c2.1-1.22 1.42-3.62-.95-4a8.6 8.6 0 0 1 1-1.72c.25-.27 1.26.23 1.56.38a.324.324 0 1 0 .29-.58c-2.23-1.2-2.29-.56-3.52 1.6c-.16.28-.36.59-.13.87s.92.21 1.18.3c.7.25 1.28.94.92 1.59c-.24.42-.83.94-1.32.87c-2-.85-1.89-1.5-2.8-.17a4.86 4.86 0 0 0-1 2.37c0 1.79 7.75 5.39 8.25 5.41c.88.05 2.13-2.62 2.13-3.18"/>
      <path fill="currentColor" fillOpacity="0.7" d="M8.71 19.548c-.32-1.39.26-5.08-1.38-5.05c-1.46 0-1.18 1.19-1.7 2.6c-.14.39-.12.43-1-.38a3.5 3.5 0 0 1-.45-.56c.08-.39-.08-.1.22-2.6c.11-.89.07-1.93-.72-2.35a1.3 1.3 0 0 0-1.55.22a1.09 1.09 0 0 0-1.07-.45C0 11.098 0 12.318 0 13.348c.06 2.74 2.2 5.68 4.24 7.51l.62 1.58c.09.27.67-.05.57-.32L5 20.448c0-.13-4.23-3.48-4.19-7.11c0-.41 0-1.52.38-1.56c.58-.06.47.46 1.27 2.55a12.5 12.5 0 0 0 1.09 2.25a4.34 4.34 0 0 0 1.78 1.5c1.25.23 1.08-1.82 1.46-2.4c.09-.15.26-.22.54-.23c1 0 .22 4.36.88 4.65c.23.11.69-.21.54-.41c.02-.02-.03-.08-.04-.14m-6.3-7.65a.71.71 0 0 1 .95-.1c.4.27.31 1.25.27 1.8a7 7 0 0 0 .05 1.61a33 33 0 0 1-1.27-3.31m12.84 7.79c-.15.2.31.52.54.41c.66-.29-.09-4.69.88-4.65c.28 0 .45.08.54.23c.38.58.21 2.63 1.46 2.4a4.34 4.34 0 0 0 1.78-1.5c.452-.71.83-1.463 1.13-2.25c.8-2.09.69-2.61 1.27-2.55c.41 0 .38 1.15.38 1.56c0 3.63-4.14 7-4.19 7.11l-.47 1.67c-.1.27.48.59.57.32l.62-1.58c2-1.83 4.18-4.77 4.24-7.51c0-1 0-2.25-1.06-2.37a1.09 1.09 0 0 0-1.1.45a1.3 1.3 0 0 0-1.55-.22c-.79.42-.83 1.46-.72 2.35c.3 2.5.14 2.21.22 2.6a3.5 3.5 0 0 1-.45.56c-.88.81-.86.77-1 .38c-.52-1.41-.24-2.6-1.7-2.6c-1.64 0-1.06 3.66-1.38 5.05c0 .06-.06.12-.04.14m6.3-7.65a33 33 0 0 1-1.27 3.31a7 7 0 0 0 .05-1.61c0-.55-.13-1.53.27-1.8a.71.71 0 0 1 .95.1"/>
    </g>
  </svg>
);

import Spinner from '../common/Spinner';

const { Sider } = Layout;

interface BoardItemProps {
  board: { id: string; name: string; projectStatus?: string; icon?: string };
  onNavDragEnter: (path: string) => void;
  onNavDragLeave: () => void;
  onNavDrop: (path: string) => void;
  onBoardUpdate?: () => void;
}

const BoardItem: React.FC<BoardItemProps> = ({ board, onNavDragEnter, onNavDragLeave, onNavDrop, onBoardUpdate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(board.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateBoard, fetchBoards } = useBoardStore();
  const isActive = `/board/${board.id}` === location.pathname;

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [statusSubmenuOpen, setStatusSubmenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const boardMenuRef = useRef<HTMLDivElement>(null);

  const [duplicateProgress, setDuplicateProgress] = useState<{ active: boolean; step: string; percent: number } | null>(null);

  // 图标相关状态
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | File>('');
  const fileInputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
        setStatusSubmenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenuOpen]);

  const keyClick = useCallback(() => {
    const { settings } = useSettingsStore.getState();
    if (settings.soundEnabled) playSound('click', settings.soundVolume);
  }, []);

  const triggerKeyClickAnim = useCallback((e: React.MouseEvent) => {
    const { settings } = useSettingsStore.getState();
    const sidebarOpen = useUIStore.getState().sidebarOpen;
    if (sidebarOpen) return;
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('key-click-anim', 'key-hover-press', 'key-hover-release');
    el.removeAttribute('data-hover-state');
    void el.offsetWidth;
    el.classList.add('key-click-anim');
    const onEnd = () => {
      el.classList.remove('key-click-anim');
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
    if (settings.soundEnabled && settings.keyPressSoundEnabled) {
      playKeyPressSound(settings.soundVolume);
    }
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const duplicateBoard = async (sourceBoardId: string, sourceBoardName: string) => {
    const steps = [
      { key: 'create', label: '创建看板' },
      { key: 'creativities', label: '复制创意关联' },
      { key: 'canvas', label: '复制画布数据' },
      { key: 'graph', label: '复制图谱数据' },
      { key: 'sticky', label: '复制便签' },
      { key: 'folders', label: '复制文件夹' },
      { key: 'chains', label: '复制创意链' },
      { key: 'outline', label: '复制写作台数据' },
    ];
    const updateProgress = (stepKey: string, percent: number) => {
      const step = steps.find(s => s.key === stepKey);
      if (step) setDuplicateProgress({ active: true, step: step.label, percent });
    };

    try {
      updateProgress('create', 5);
      const newBoard = await api.board.create({ name: `[副本] ${sourceBoardName}` });
      if (!newBoard) { setDuplicateProgress(null); return null; }

      const newBoardId = newBoard.id;

      updateProgress('creativities', 15);
      const creativities = await api.board.listCreativities(sourceBoardId);
      if (creativities?.length) {
        await Promise.all(creativities.map((c: any) => api.board.addCreativityRelation(newBoardId, c.id)));
      }

      updateProgress('canvas', 25);
      const canvasItems = await api.board.canvas.listItems(sourceBoardId);
      const itemIdMap: Record<string, string> = {};
      if (canvasItems?.length) {
        for (let i = 0; i < canvasItems.length; i++) {
          const item = canvasItems[i];
          const newItem = await api.board.canvas.addItem(newBoardId, item.creativityId, item.positionX, item.positionY, item.width, item.height, item.title, item.content, item.type, item.isLinked);
          if (newItem) itemIdMap[item.id] = newItem.id;
          updateProgress('canvas', 25 + Math.round((i + 1) / canvasItems.length * 10));
        }
      }

      updateProgress('canvas', 35);
      const canvasEdges = await api.board.canvas.listEdges(sourceBoardId);
      if (canvasEdges?.length) {
        for (const edge of canvasEdges) {
          const newSourceId = itemIdMap[edge.sourceItemId] || edge.sourceItemId;
          const newTargetId = itemIdMap[edge.targetItemId] || edge.targetItemId;
          await api.board.canvas.addEdge(newBoardId, newSourceId, newTargetId, edge.edgeType, edge.sourceConnector, edge.targetConnector);
        }
      }

      updateProgress('graph', 45);
      const graphNodes = await api.board.graph.listNodes(sourceBoardId);
      const nodeIdMap: Record<string, string> = {};
      if (graphNodes?.length) {
        const nodeMap: Record<string, any> = {};
        for (const node of graphNodes) nodeMap[node.id] = node;

        const createNodeWithParent = async (node: any) => {
          const newNode = await api.board.graph.addNode(newBoardId, {
            creativityId: node.creativityId,
            parentId: node.parentId ? (nodeIdMap[node.parentId] || null) : null,
            label: node.label,
            positionX: node.positionX,
            positionY: node.positionY,
            nodeType: node.nodeType,
          });
          if (newNode) nodeIdMap[node.id] = newNode.id;
        };

        const rootNodes = graphNodes.filter((n: any) => !n.parentId);
        const childNodes = graphNodes.filter((n: any) => n.parentId);

        for (const node of rootNodes) await createNodeWithParent(node);

        let remaining = [...childNodes];
        let maxIterations = remaining.length + 1;
        while (remaining.length > 0 && maxIterations-- > 0) {
          const creatable = remaining.filter((n: any) => nodeIdMap[n.parentId]);
          if (creatable.length === 0) break;
          for (const node of creatable) await createNodeWithParent(node);
          remaining = remaining.filter((n: any) => !nodeIdMap[n.id]);
        }
        for (const node of remaining) await createNodeWithParent(node);
      }

      updateProgress('graph', 60);
      const graphEdges = await api.board.graph.listEdges(sourceBoardId);
      if (graphEdges?.length) {
        for (const edge of graphEdges) {
          const newSourceId = nodeIdMap[edge.sourceNodeId] || edge.sourceNodeId;
          const newTargetId = nodeIdMap[edge.targetNodeId] || edge.targetNodeId;
          await api.board.graph.addEdge(newBoardId, newSourceId, newTargetId, edge.edgeType);
        }
      }

      updateProgress('sticky', 70);
      const stickyNotes = await api.board.sticky.list(sourceBoardId);
      if (stickyNotes?.length) {
        for (let i = 0; i < stickyNotes.length; i++) {
          const note = stickyNotes[i];
          await api.board.sticky.add(newBoardId, {
            title: note.title,
            content: note.content,
            color: note.color,
            positionX: note.positionX,
            positionY: note.positionY,
            width: note.width,
            height: note.height,
            sourceCreativityIds: note.sourceCreativityIds,
            sortOrder: note.sortOrder,
            type: note.type,
            creativeChainId: note.creativeChainId,
            tags: note.tags,
          });
          updateProgress('sticky', 70 + Math.round((i + 1) / stickyNotes.length * 10));
        }
      }

      updateProgress('folders', 85);
      const folders = await api.board.folder.list(sourceBoardId);
      const folderIdMap: Record<string, string> = {};
      if (folders?.length) {
        for (const folder of folders) {
          const newFolder = await api.board.folder.create(newBoardId, folder.name, folder.color);
          if (newFolder) folderIdMap[folder.id] = newFolder.id;
        }
        for (const folder of folders) {
          const items = await api.board.folder.getItems(folder.id);
          if (items?.length && folderIdMap[folder.id]) {
            await api.board.folder.addItems(folderIdMap[folder.id], items.map((i: any) => i.id));
          }
        }
      }

      updateProgress('chains', 95);
      const chains = await api.board.creativeChain.list(sourceBoardId);
      if (chains?.length) {
        for (const chain of chains) {
          await api.board.creativeChain.create(newBoardId, {
            name: chain.name,
            description: chain.description,
            tags: chain.tags,
            color: chain.color,
            snapshot: chain.snapshot,
          });
        }
      }

      updateProgress('outline', 97);
      try {
        const sourceVolumes = localStorage.getItem('mindvault_volumes_' + sourceBoardId);
        if (sourceVolumes) {
          localStorage.setItem('mindvault_volumes_' + newBoardId, sourceVolumes);
        }
      } catch (e) {
        console.error('复制卷数据失败:', e);
      }

      try {
        const chaptersMapStr = localStorage.getItem('mindvault_chapters_with_volume');
        if (chaptersMapStr) {
          const chaptersMap = JSON.parse(chaptersMapStr);
          const sourceVolumeStr = localStorage.getItem('mindvault_volumes_' + sourceBoardId);
          const sourceVolumeIds = sourceVolumeStr ? (JSON.parse(sourceVolumeStr) as Array<{id: string}>).map(v => v.id) : [];
          const newEntries: Record<string, string> = {};
          for (const [cId, vId] of Object.entries(chaptersMap)) {
            if (sourceVolumeIds.includes(vId as string)) {
              newEntries[cId] = vId as string;
            }
          }
          if (Object.keys(newEntries).length > 0) {
            const mergedMap = { ...chaptersMap, ...newEntries };
            localStorage.setItem('mindvault_chapters_with_volume', JSON.stringify(mergedMap));
          }
        }
      } catch (e) {
        console.error('复制章节关联失败:', e);
      }

      updateProgress('chains', 100);
      return newBoard;
    } finally {
      setTimeout(() => setDuplicateProgress(null), 500);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setCropperOpen(true);
    }
    // 清空 input 值，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理裁剪完成
  const handleCropComplete = async (croppedImage: string) => {
    try {
      // 上传图标
      const filePath = await api.board.uploadIcon(board.id, croppedImage);
      if (filePath) {
        // 更新看板图标路径
        await api.board.updateIcon(board.id, filePath);
        // 刷新看板列表
        if (onBoardUpdate) {
          onBoardUpdate();
        }
        message.success('图标更换成功');
      } else {
        message.error('图标上传失败，请重试');
      }
    } catch (err) {
      console.error('上传图标失败:', err);
      message.error('图标上传失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setCropperOpen(false);
      setSelectedImage('');
    }
  };

  // 处理删除图标
  const handleDeleteIcon = async () => {
    try {
      await api.board.deleteIcon(board.id);
      if (onBoardUpdate) {
        onBoardUpdate();
      }
      message.success('图标已移除');
    } catch (err) {
      console.error('删除图标失败:', err);
      message.error('移除图标失败');
    }
  };

  const handleContextMenuAction = async (action: string) => {
    if (action === 'rename') {
      setContextMenuOpen(false);
      setRenameValue(board.name);
      setRenameModalOpen(true);
      return;
    }
    if (action === 'duplicate') {
      setContextMenuOpen(false);
      try {
        const newBoard = await duplicateBoard(board.id, board.name);
        if (newBoard) {
          await fetchBoards();
          navigate(`/board/${newBoard.id}`);
        }
      } catch (err: unknown) {
        console.error('复制失败:', err);
      }
      return;
    }
    if (action === 'delete') {
      setContextMenuOpen(false);
      setDeleteConfirmOpen(true);
      return;
    }
    if (action === 'change-icon') {
      setContextMenuOpen(false);
      fileInputRef.current?.click();
      return;
    }
    if (action === 'remove-icon') {
      setContextMenuOpen(false);
      await handleDeleteIcon();
      return;
    }
    if (action.startsWith('status:')) {
      const status = action.replace('status:', '');
      setContextMenuOpen(false);
      try {
        await updateBoard(board.id, { project_status: status });
      } catch (err: unknown) {
        console.error('更新项目状态失败:', err);
      }
      return;
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      const creativities = await api.board.listCreativities(board.id);
      const creativityIds = (creativities || []).map((c: any) => c.id);
      await api.trash.add({
        itemType: 'board',
        itemId: board.id,
        sourceBoardId: board.id,
        sourceBoardName: board.name,
        snapshot: {
          name: board.name,
          description: (board as any).description || '',
          layout: (board as any).layout || 'board',
          creativityIds,
          creativityCount: creativityIds.length,
        },
      });
      await api.board.delete(board.id);
      fetchBoards();
    } catch (err: unknown) {
      console.error('删除失败:', err);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!editName.trim()) {
      setIsEditing(false);
      setEditName(board.name);
      return;
    }
    if (editName === board.name) {
      setIsEditing(false);
      return;
    }
    try {
      await updateBoard(board.id, { name: editName.trim() });
    } catch (error) {
      console.error('更新看板失败:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sidebarOpen) return;
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDraggingItem) return;
    triggerKeyClickAnim(e);
    keyClick();
    navigate(`/board/${board.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(board.name);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={(e) => {
        if (!sidebarOpen) return;
        e.stopPropagation();
        setIsEditing(true);
      }}
      onMouseEnter={() => onNavDragEnter(`/board/${board.id}`)}
      onMouseLeave={onNavDragLeave}
      onMouseUp={() => onNavDrop(`/board/${board.id}`)}
      onContextMenu={handleContextMenu}
      className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: sidebarOpen ? '10px 14px' : '12px',
        borderRadius: 8,
        backgroundColor: sidebarOpen
          ? (isActive ? 'var(--bg-active)' : 'transparent')
          : (isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.06)'),
        backdropFilter: sidebarOpen ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: sidebarOpen ? 'none' : 'blur(12px)',
        color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
        fontSize: 13,
        cursor: isDraggingItem ? 'grabbing' : 'pointer',
        marginBottom: 4,
        transition: 'all 0.15s ease',
        border: sidebarOpen
                          ? (isActive ? '1px solid var(--primary-color)20' : '1px solid transparent')
                          : '1px solid rgba(255, 255, 255, 0.15)',
                      borderWidth: sidebarOpen ? (isActive ? '1px' : '1px') : '1px 1px 2px',
                      borderColor: sidebarOpen
                          ? (isActive ? 'var(--primary-color)20' : 'transparent')
                          : (isActive
                              ? 'rgba(255, 255, 255, 0.25) rgba(0, 0, 0, 0.06) rgba(0, 0, 0, 0.1) rgba(255, 255, 255, 0.12)'
                              : 'rgba(255, 255, 255, 0.18) rgba(0, 0, 0, 0.06) rgba(0, 0, 0, 0.1) rgba(255, 255, 255, 0.1)'),
                      boxShadow: sidebarOpen
                          ? (isActive
                              ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.1), inset -2px -2px 5px rgba(255, 255, 255, 0.5)'
                              : 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3)')
                          : (isActive
                              ? 'rgba(0, 0, 0, 0.1) 0px 2px 0px, rgba(255, 255, 255, 0.15) 0px 1px 0px inset, rgba(255, 255, 255, 0.06) 0px 0px 8px inset'
                              : 'rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.12) 0px 1px 0px inset, rgba(255, 255, 255, 0.04) 0px 0px 6px inset'),
      }}
      title={!sidebarOpen ? undefined : board.name}
    >
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* 图标显示 */}
      <BoardIcon board={board} size={sidebarOpen ? 'small' : 'medium'} />
      {sidebarOpen && (
        isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              padding: '4px 8px',
              border: '1px solid var(--primary-color)',
              borderRadius: 6,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {board.name}
          </span>
        )
      )}
      
      {/* 删除确认 */}
      <Popconfirm
        open={deleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        title={`确定要删除创意库"${board.name}"吗？`}
        description="删除后可在回收站恢复"
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <span />
      </Popconfirm>

      {/* 右键菜单 */}
      {contextMenuOpen && createPortal(
        <div
          ref={boardMenuRef}
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
            onClick={() => handleContextMenuAction('duplicate')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Copy size={14} />
            <span>创建副本</span>
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />
          <div
            onClick={() => handleContextMenuAction('change-icon')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Image size={14} />
            <span>更换图标</span>
          </div>
          {board.icon && (
            <div
              onClick={() => handleContextMenuAction('remove-icon')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6, margin: '0 4px' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Trash2 size={14} />
              <span>移除图标</span>
            </div>
          )}
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />
          {/* 项目状态子菜单 */}
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
                position: 'absolute',
                left: '100%',
                top: -6,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '4px 0',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                minWidth: 140,
                zIndex: 100000,
              }}>
                {[
                  { key: 'status:active', icon: CircleCheck, label: '进行中', active: board.projectStatus === 'active' || !board.projectStatus },
                  { key: 'status:paused', icon: CirclePause, label: '已暂停', active: board.projectStatus === 'paused' },
                  { key: 'status:completed', icon: CircleCheckBig, label: '已完成', active: board.projectStatus === 'completed' },
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => handleContextMenuAction(item.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 13, borderRadius: 6, margin: '0 4px',
                      color: item.active ? 'var(--primary-color)' : 'var(--text-primary)',
                      fontWeight: item.active ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </div>
                ))}
                <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 8px' }} />
                <div
                  onClick={() => handleContextMenuAction('status:archived')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
                    fontSize: 13, borderRadius: 6, margin: '0 4px',
                    color: board.projectStatus === 'archived' ? 'var(--primary-color)' : 'var(--text-primary)',
                    fontWeight: board.projectStatus === 'archived' ? 600 : 400,
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
            onClick={() => handleContextMenuAction('delete')}
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

      <AnimatePresence>
        {duplicateProgress && duplicateProgress.active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              padding: '20px 28px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
              zIndex: 99999,
              minWidth: 280,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Progress
                type="circle"
                percent={duplicateProgress.percent}
                status={duplicateProgress.percent === 100 ? 'success' : 'active'}
                size={40}
                strokeColor="var(--primary-color)"
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {duplicateProgress.step}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                {duplicateProgress.percent}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片裁剪 Modal */}
      <ImageCropper
        open={cropperOpen}
        image={selectedImage}
        aspectRatio={1}
        onCrop={handleCropComplete}
        onCancel={() => {
          setCropperOpen(false);
          setSelectedImage('');
        }}
      />

    </div>
  );
};

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleQuickCapture = useUIStore((s) => s.toggleQuickCapture);
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const setDragOverTarget = useUIStore((s) => s.setDragOverTarget);
  const endDrag = useUIStore((s) => s.endDrag);
  const { settings } = useSettingsStore();
  const createCreativity = useCreativityStore((s) => s.createCreativity);
  const [isDropOverQuickCapture, setIsDropOverQuickCapture] = useState(false);

  const keyClick = useCallback(() => {
    if (settings.soundEnabled) playSound('click', settings.soundVolume);
  }, [settings.soundEnabled, settings.soundVolume]);

  const triggerKeyClickAnim = useCallback((e: React.MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
    if (sidebarOpen) return;
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('key-click-anim', 'key-hover-press', 'key-hover-release');
    el.removeAttribute('data-hover-state');
    void el.offsetWidth;
    el.classList.add('key-click-anim');
    const onEnd = () => {
      el.classList.remove('key-click-anim');
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
    if (settings.soundEnabled && settings.keyPressSoundEnabled) {
      playKeyPressSound(settings.soundVolume);
    }
  }, [sidebarOpen, settings.soundEnabled, settings.keyPressSoundEnabled, settings.soundVolume]);

  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const { toggleTheme, isDark, theme, setTheme, isTransitioning, transitionDirection, transitionPhase, transitionColor } = useTheme();
  const themeOptions = useThemeOptions();
  const [boardsExpanded, setBoardsExpanded] = useState(true);
  const [statusGroupExpanded, setStatusGroupExpanded] = useState<Record<string, boolean>>({
    active: true,
    paused: false,
    completed: false,
  });
  const [newBoardInputVisible, setNewBoardInputVisible] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const newBoardInputRef = useRef<HTMLInputElement>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [floatingNotes, setFloatingNotes] = useState<FloatingNote[]>([]);
  const noteIdRef = useRef(0);
  const quickCaptureBtnRef = useRef<HTMLDivElement>(null);
  const siderContainerRef = useRef<HTMLDivElement>(null);
  const [newBoardPopupVisible, setNewBoardPopupVisible] = useState(false);
  const newBoardPopupNameRef = useRef<HTMLInputElement>(null);

  const spawnNotes = useCallback((e: React.MouseEvent) => {
    if (!settings.soundEnabled) return;
    const rect = quickCaptureBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const count = 2 + Math.floor(Math.random() * 3);
    const newNotes: FloatingNote[] = [];
    for (let i = 0; i < count; i++) {
      const { noteName, symbol } = playPianoNote(settings.soundVolume);
      newNotes.push({
        id: noteIdRef.current++,
        symbol,
        noteName,
        x: e.clientX - rect.left + (Math.random() - 0.5) * 40,
        y: e.clientY - rect.top - 10,
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      });
    }
    setFloatingNotes(prev => [...prev, ...newNotes]);
    setTimeout(() => {
      setFloatingNotes(prev => prev.filter(n => !newNotes.some(nn => nn.id === n.id)));
    }, 1200);
  }, [settings.soundEnabled, settings.soundVolume]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (newBoardInputVisible && newBoardInputRef.current) {
      newBoardInputRef.current.focus();
    }
  }, [newBoardInputVisible]);

  useEffect(() => {
    if (newBoardPopupVisible && newBoardPopupNameRef.current) {
      newBoardPopupNameRef.current.focus();
    }
  }, [newBoardPopupVisible]);

  useEffect(() => {
    const container = siderContainerRef.current;
    if (!container) return;

    const getKeyBtn = (target: EventTarget | null): Element | null => {
      if (!target || !(target instanceof HTMLElement)) return null;
      return target.closest('.sidebar-key-btn, .sidebar-key-btn-gradient');
    };

    const handleMouseOver = (e: MouseEvent) => {
      const btn = getKeyBtn(e.target);
      if (!btn) return;
      if (btn.getAttribute('data-hover-state') === 'pressing') return;
      btn.setAttribute('data-hover-state', 'pressing');
      btn.classList.remove('key-hover-release');
      void btn.offsetWidth;
      btn.classList.add('key-hover-press');
    };

    const handleMouseOut = (e: MouseEvent) => {
      const btn = getKeyBtn(e.target);
      if (!btn) return;
      if (btn.contains(e.relatedTarget as HTMLElement)) return;
      btn.setAttribute('data-hover-state', 'releasing');
      btn.classList.remove('key-hover-press');
      void btn.offsetWidth;
      btn.classList.add('key-hover-release');
      const onEnd = () => {
        btn.classList.remove('key-hover-release');
        btn.removeAttribute('data-hover-state');
        btn.removeEventListener('animationend', onEnd);
      };
      btn.addEventListener('animationend', onEnd);
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  const handleCreateBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    try {
      const board = await api.board.create({ name });
      await fetchBoards();
      setNewBoardName('');
      setNewBoardInputVisible(false);
      setNewBoardPopupVisible(false);
      if (board) navigate(`/board/${board.id}`);
    } catch (error) {
      console.error('创建看板失败:', error);
    }
  };

  const handleCreateBoardFromPopup = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    try {
      const board = await api.board.create({ name });
      await fetchBoards();
      setNewBoardName('');
      setNewBoardPopupVisible(false);
      if (board) navigate(`/board/${board.id}`);
    } catch (error) {
      console.error('创建看板失败:', error);
    }
  };

  const dragEnded = useUIStore((s) => s.dragEnded);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const dragHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavDragEnter = useCallback((path: string) => {
    if (!isDraggingItem) return;
    setDragOverTarget(path);
    if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);
    dragHoverTimerRef.current = setTimeout(() => {
      navigate(path);
      dragHoverTimerRef.current = null;
    }, 100);
  }, [isDraggingItem, setDragOverTarget, navigate]);

  const handleNavDragLeave = useCallback(() => {
    setDragOverTarget(null);
    if (dragHoverTimerRef.current) {
      clearTimeout(dragHoverTimerRef.current);
      dragHoverTimerRef.current = null;
    }
  }, [setDragOverTarget]);

  const handleNavDrop = useCallback((target: string) => {
    if (!isDraggingItem || !dragItem) return;
    useUIStore.getState().setDragOverTarget(target);
  }, [isDraggingItem, dragItem]);

  const handleSelectTheme = (themeValue: string) => {
    try {
      setTheme(themeValue as any);
    } catch (error) {
      console.error('切换主题失败:', error);
    } finally {
      setContextMenuOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    {
      key: '/',
      icon: <HomeIcon size={24} style={{ marginLeft: 2 }} />,
      label: '首页',
      onClick: (e: React.MouseEvent) => { triggerKeyClickAnim(e); keyClick(); if (!isDraggingItem) navigate('/'); },
      onMouseEnter: () => handleNavDragEnter('/'),
      onMouseLeave: handleNavDragLeave,
      onMouseUp: () => handleNavDrop('/'),
    },
    {
      key: '/search',
      icon: <SearchIcon size={24} style={{ marginLeft: 2 }} />,
      label: '仓库',
      onClick: (e: React.MouseEvent) => { triggerKeyClickAnim(e); keyClick(); if (!isDraggingItem) navigate('/search'); },
      onMouseEnter: () => handleNavDragEnter('/search'),
      onMouseLeave: handleNavDragLeave,
    },

    {
      key: '/trash',
      icon: <WCIcon size={24} style={{ marginLeft: 2 }} />,
      label: '回收站',
      onClick: (e: React.MouseEvent) => { triggerKeyClickAnim(e); keyClick(); if (!isDraggingItem) navigate('/trash'); },
      onMouseEnter: () => handleNavDragEnter('/trash'),
      onMouseLeave: handleNavDragLeave,
      onMouseUp: () => handleNavDrop('/trash'),
    },
  ];

  const selectedKey = menuItems.find(item => isActive(item.key))?.key || '/';

  return (
    <Sider
      width={240}
      collapsedWidth={64}
      collapsible
      collapsed={!sidebarOpen}
      onCollapse={toggleSidebar}
      theme="light"
      trigger={null}
      className="sidebar-container"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        height: '100vh',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-light)',
      }}
    >
      <div ref={siderContainerRef} style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        overflow: 'hidden' 
      }}>
        {/* Logo 区域 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: sidebarOpen ? '20px 24px' : '20px 16px',
          gap: '12px',
          height: 64,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div
            style={{
              width: 45,
              height: 45,
              borderRadius: 8,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: 'inset 2px 2px 6px rgba(0, 0, 0, 0.2), inset -2px -2px 6px rgba(255, 255, 255, 0.3)',
              transform: 'translateX(-6px)',
            }}
          >
            <img src="./images/app-logo.png" alt="Logo" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {APP_NAME}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>MindVault</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 快速录入按钮 */}
      <div
        ref={quickCaptureBtnRef}
        style={{ padding: sidebarOpen ? '0 16px 16px 16px' : '0 12px 16px 12px', flexShrink: 0, position: 'relative' }}
        onContextMenu={async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          triggerKeyClickAnim(e);
          spawnNotes(e);
          keyClick();

          // 使用文件选择对话框选择文件
          const filePaths = await api.file.selectMultiple([
            { name: '所有文件', extensions: ['*'] },
            { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
            { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] },
            { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
            { name: '文档文件', extensions: ['pdf', 'txt', 'md'] },
          ]);
          if (!filePaths || filePaths.length === 0) return;

          // 触发自定义事件，让 App.tsx 打开批量导入确认弹窗
          // 将文件路径信息包装后传递
          const filesWithInfo = filePaths.map((p: string) => {
            const name = p.split(/[\\/]/).pop() || p;
            return { path: p, name };
          });
          window.dispatchEvent(new CustomEvent('batch-import-request', { detail: filesWithInfo }));
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setIsDropOverQuickCapture(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDropOverQuickCapture(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDropOverQuickCapture(false);

          if (!e.dataTransfer.types.includes('Files')) return;
          const files = Array.from(e.dataTransfer.files);
          if (files.length === 0) return;

          // 触发批量导入确认弹窗
          const filesWithInfo = files.map((f) => ({
            path: '',
            name: f.name,
            file: f,
          }));
          // 对于拖拽文件，直接使用 File 对象触发事件
          window.dispatchEvent(new CustomEvent('batch-import-drop', { detail: files }));
        }}
      >
        <Button
          type="primary"
          block
          icon={<PlusCircleIcon size={18} />}
          onClick={(e: React.MouseEvent) => { triggerKeyClickAnim(e); spawnNotes(e); keyClick(); toggleQuickCapture(); }}
          className={!sidebarOpen ? 'sidebar-key-btn-gradient' : 'piano-key-btn'}
          style={{
            background: isDropOverQuickCapture
              ? 'linear-gradient(135deg, var(--primary-color), var(--primary-light))'
              : sidebarOpen
              ? 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,245,0.95) 60%, rgba(220,220,230,0.95) 100%)'
              : 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
            border: sidebarOpen
              ? '1.5px solid rgba(0, 0, 0, 0.08)'
              : '2px solid rgba(0, 0, 0, 0.12)',
            borderWidth: sidebarOpen ? '1.5px 1.5px 4px' : '2px 2px 4px',
            borderRadius: 8,
            height: 40,
            color: isDropOverQuickCapture ? 'white' : sidebarOpen ? 'var(--primary-color)' : 'white',
            boxShadow: isDropOverQuickCapture
              ? '0 0 16px rgba(108, 99, 255, 0.5), 0 4px 0 0 rgba(0,0,0,0.1)'
              : sidebarOpen
              ? '0 4px 0 0 rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.05)'
              : 'rgba(0, 0, 0, 0.112) 0px 4px 0px, rgba(255, 255, 255, 0.14) 0px 2px 0px inset',
            transition: 'all 0.15s ease',
            fontWeight: sidebarOpen ? 600 : 400,
          }}
          onMouseDown={() => {
            const btn = quickCaptureBtnRef.current?.querySelector('.ant-btn');
            if (btn) {
              (btn as HTMLElement).style.transform = 'translateY(2px)';
              (btn as HTMLElement).style.boxShadow = sidebarOpen
                ? '0 1px 0 0 rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)'
                : '0 1px 0 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)';
              (btn as HTMLElement).style.borderWidth = sidebarOpen ? '1.5px 1.5px 2px' : '2px 2px 2px';
            }
          }}
          onMouseUp={() => {
            const btn = quickCaptureBtnRef.current?.querySelector('.ant-btn');
            if (btn) {
              (btn as HTMLElement).style.transform = 'translateY(0)';
              (btn as HTMLElement).style.boxShadow = sidebarOpen
                ? '0 4px 0 0 rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.05)'
                : 'rgba(0, 0, 0, 0.112) 0px 4px 0px, rgba(255, 255, 255, 0.14) 0px 2px 0px inset';
              (btn as HTMLElement).style.borderWidth = sidebarOpen ? '1.5px 1.5px 4px' : '2px 2px 4px';
            }
          }}
          onMouseLeave={() => {
            const btn = quickCaptureBtnRef.current?.querySelector('.ant-btn');
            if (btn) {
              (btn as HTMLElement).style.transform = 'translateY(0)';
              (btn as HTMLElement).style.boxShadow = sidebarOpen
                ? '0 4px 0 0 rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.05)'
                : 'rgba(0, 0, 0, 0.112) 0px 4px 0px, rgba(255, 255, 255, 0.14) 0px 2px 0px inset';
              (btn as HTMLElement).style.borderWidth = sidebarOpen ? '1.5px 1.5px 4px' : '2px 2px 4px';
            }
          }}
        >
          {sidebarOpen && <span style={{ transform: 'translateY(-1px)', display: 'inline-block' }}>快速录入</span>}
        </Button>

        {/* 飘出的音符动画 */}
        <AnimatePresence>
          {floatingNotes.map(note => (
            <motion.div
              key={note.id}
              initial={{ opacity: 1, y: note.y, x: note.x, scale: 1 }}
              animate={{
                opacity: 0,
                y: note.y - 80 - Math.random() * 40,
                x: note.x + (Math.random() - 0.5) * 60,
                scale: 0.5,
                rotate: (Math.random() - 0.5) * 30,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 + Math.random() * 0.4, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                fontSize: 22 + Math.random() * 8,
                color: note.color,
                zIndex: 100,
                textShadow: `0 0 8px ${note.color}`,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              {note.symbol}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 导航菜单 */}
      <nav style={{ padding: '0 8px', flexShrink: 0 }}>
        {menuItems.map(item => {
          const active = isActive(item.key);
          return (
            <div
              key={item.key}
              onClick={item.onClick}
              onMouseEnter={item.onMouseEnter}
              onMouseLeave={item.onMouseLeave}
              onMouseUp={item.onMouseUp}
              className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '10px 14px' : '8px',
                borderRadius: 8,
                backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                color: active ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                cursor: isDraggingItem ? 'grabbing' : 'pointer',
                marginBottom: 6,
                transition: 'all 0.15s ease',
                border: sidebarOpen
                  ? (active ? '1px solid var(--primary-color)20' : '1px solid transparent')
                  : '2px solid rgba(0, 0, 0, 0.12)',
                borderWidth: sidebarOpen ? (active ? '1px' : '1px') : '2px 2px 4px',
                boxShadow: sidebarOpen
                  ? (active
                      ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.1), inset -2px -2px 5px rgba(255, 255, 255, 0.5)'
                      : 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3)')
                  : 'rgba(0, 0, 0, 0.112) 0px 4px 0px, rgba(255, 255, 255, 0.14) 0px 2px 0px inset',
              }}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          );
        })}
      </nav>

      {/* 我的创意库区域 - 可滚动 */}
      <div style={{
        flex: 1,
        padding: sidebarOpen ? '1px 8px' : '4px',
        overflowY: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(!sidebarOpen ? {
          backgroundColor: boardsExpanded ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          borderRadius: 16,
          margin: '0 4px',
          boxShadow: boardsExpanded ? 'inset 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)' : 'none',
          border: boardsExpanded ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
          transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        } : {}),
      }}>
        <div
          onClick={(e) => { triggerKeyClickAnim(e); setBoardsExpanded(!boardsExpanded); }}
          className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
          onMouseEnter={() => {
            if (isDraggingItem && !boardsExpanded) {
              setBoardsExpanded(true);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            padding: sidebarOpen ? '6px 14px' : '5px',
            cursor: 'pointer',
            borderRadius: 8,
            flexShrink: 0,
            borderWidth: sidebarOpen ? '1px 1px 3px' : '2px 2px 4px',
            borderStyle: 'solid',
            borderColor: sidebarOpen
              ? 'rgba(255, 255, 255, 0.25) rgba(0, 0, 0, 0.06) rgba(0, 0, 0, 0.12) rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0.06) rgba(0, 0, 0, 0.1) rgba(255, 255, 255, 0.12)',
            boxShadow: sidebarOpen
              ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3), rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.12) 0px 1px 0px inset'
              : 'inset 2px 2px 5px rgba(0, 0, 0, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.12) 0px 4px 0px, rgba(255, 255, 255, 0.15) 0px 2px 0px inset',
            backgroundColor: sidebarOpen ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {sidebarOpen ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                我的创意库
              </span>
              <span style={{ transition: 'transform 0.2s', transform: boardsExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                <ChevronRight size={14} />
              </span>
            </>
          ) : (
            <PuzzleNavIcon size={30} />
          )}
        </div>

        <AnimatePresence>
          {boardsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.9 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              transition={{ 
                height: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
                opacity: { duration: 0.2 },
                scale: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
              }}
              style={{ overflow: 'hidden', flexShrink: 0, transformOrigin: 'top center' }}
            >
              {(() => {
                const activeBoards = boards.filter((b: any) => (!b.projectStatus && !b.project_status) || b.projectStatus === 'active' || b.project_status === 'active');
                const pausedBoards = boards.filter((b: any) => b.projectStatus === 'paused' || b.project_status === 'paused');
                const completedBoards = boards.filter((b: any) => b.projectStatus === 'completed' || b.project_status === 'completed');
                const archivedBoards = boards.filter((b: any) => b.projectStatus === 'archived' || b.project_status === 'archived');

                const statusGroups: { key: string; label: string; color: string; items: any[] }[] = [
                  { key: 'active', label: '进行中', color: 'var(--primary-color)', items: activeBoards },
                  { key: 'paused', label: '已暂停', color: '#F59E0B', items: pausedBoards },
                  { key: 'completed', label: '已完成', color: '#10B981', items: completedBoards },
                  { key: 'archived', label: '已归档', color: '#6B7280', items: archivedBoards },
                ];

                const nonEmptyGroups = statusGroups.filter(g => g.items.length > 0);

                return nonEmptyGroups.length === 0 ? (
                  <>
                    {sidebarOpen && boards.length === 0 && (
                      <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-tertiary)', opacity: 0.6 }}>
                        暂无创意库
                      </div>
                    )}
                  </>
                ) : (
                  nonEmptyGroups.map(group => {
                    const isExpanded = statusGroupExpanded[group.key] !== false;
                    return (
                      <div key={group.key}>
                        {sidebarOpen ? (
                          // 展开状态 - 原有样式
                          <div
                            onClick={() => setStatusGroupExpanded(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 14px 2px 14px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: group.color,
                                flexShrink: 0,
                              }} />
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                {group.label}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-quaternary, var(--text-tertiary))', opacity: 0.7 }}>
                                {group.items.length}
                              </span>
                            </div>
                            <span style={{
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                              display: 'flex',
                              alignItems: 'center',
                            }}>
                              <ChevronRight size={10} />
                            </span>
                          </div>
                        ) : (
                          // 收起状态 - 扁矮小按钮，横着显示文字
                          <div
                            onClick={() => setStatusGroupExpanded(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              padding: '4px 6px',
                              margin: '2px 0',
                              borderRadius: 6,
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? 'var(--primary-bg, rgba(108, 99, 255, 0.1))' : 'transparent',
                              border: `1px solid ${isExpanded ? 'var(--primary-color)' : 'rgba(0,0,0,0.08)'}`,
                              transition: 'all 0.15s ease',
                            }}
                            title={`${group.label} (${group.items.length})`}
                          >
                            <span style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              backgroundColor: group.color,
                              flexShrink: 0,
                            }} />
                            <span style={{ 
                              fontSize: 10, 
                              color: isExpanded ? 'var(--primary-color)' : 'var(--text-secondary)', 
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}>
                              {group.label}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.8 }}>
                              {group.items.length}
                            </span>
                          </div>
                        )}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: 'hidden' }}
                            >
                              {group.items.map((board: any) => (
                                <BoardItem
                                  key={board.id}
                                  board={{
                                    id: board.id,
                                    name: board.name,
                                    projectStatus: board.projectStatus || board.project_status,
                                    icon: board.icon,
                                  }}
                                  onNavDragEnter={handleNavDragEnter}
                                  onNavDragLeave={handleNavDragLeave}
                                  onNavDrop={handleNavDrop}
                                  onBoardUpdate={fetchBoards}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                );
              })()}
              {newBoardInputVisible && sidebarOpen ? (
                <div style={{ padding: '4px 8px' }}>
                  <input
                    ref={newBoardInputRef}
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBoard();
                      if (e.key === 'Escape') { setNewBoardInputVisible(false); setNewBoardName(''); }
                    }}
                    onBlur={() => { if (!newBoardName.trim()) { setNewBoardInputVisible(false); } }}
                    placeholder="输入创意库名称..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <Popover
                  trigger="click"
                  placement="rightTop"
                  open={newBoardPopupVisible}
                  onOpenChange={(visible) => {
                    setNewBoardPopupVisible(visible);
                    if (visible) setNewBoardName('');
                  }}
                  content={
                    <div style={{ minWidth: 220 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                        新增创意库
                      </div>
                      <input
                        ref={newBoardPopupNameRef}
                        type="text"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateBoardFromPopup();
                          if (e.key === 'Escape') setNewBoardPopupVisible(false);
                        }}
                        placeholder="输入名称..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                          marginBottom: 12,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <motion.button
                          onClick={() => setNewBoardPopupVisible(false)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: 'none',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          取消
                        </motion.button>
                        <motion.button
                          onClick={handleCreateBoardFromPopup}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                            color: 'white',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          创建
                        </motion.button>
                      </div>
                    </div>
                  }
                >
                  <div
                    onClick={(e) => { 
                      triggerKeyClickAnim(e); 
                      keyClick();
                      if (sidebarOpen) {
                        setNewBoardInputVisible(true);
                      }
                    }}
                    className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: sidebarOpen ? '10px 14px' : '10px',
                      borderRadius: 8,
                      color: 'var(--text-tertiary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      boxShadow: sidebarOpen
                        ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3)'
                        : 'none',
                    }}
                  >
                    <PlusCircleIcon size={20} style={{ flexShrink: 0 }} />
                    {sidebarOpen && <span>新增创意库</span>}
                  </div>
                </Popover>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 右键菜单 */}
      <AnimatePresence>
        {contextMenuOpen && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            style={{
              position: 'fixed',
              left: Math.min(contextMenuPos.x, window.innerWidth - 220),
              top: Math.min(contextMenuPos.y, window.innerHeight - 300),
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 8,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              zIndex: 9999,
              minWidth: 200,
            }}
          >
            <div style={{
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              borderBottom: '1px solid var(--border-light)',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Palette size={14} />
              选择主题
            </div>
            {themeOptions.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => handleSelectTheme(option.value)}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <span>{option.label}</span>
                {theme === option.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</span>
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部按钮区域 - 主题切换 + 展开收起 */}
      <div style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '8px', paddingBottom: '8px' }}>
        {/* 主题切换按钮 */}
        <div style={{ padding: '0 8px 4px 8px', flexShrink: 0 }}>
          <motion.button
            onClick={(e) => { triggerKeyClickAnim(e); keyClick(); toggleTheme(); }}
            onContextMenu={handleContextMenu}
            whileHover={!sidebarOpen ? {} : { backgroundColor: 'var(--bg-hover)' }}
            className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: sidebarOpen ? '10px 14px' : '10px',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              background: 'transparent',
              border: sidebarOpen
                ? '1px solid transparent'
                : '2px solid rgba(0, 0, 0, 0.12)',
              borderWidth: sidebarOpen ? '1px' : '2px 2px 4px',
              boxShadow: sidebarOpen
                ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.16) 0px 4px 0px, rgba(255, 255, 255, 0.2) 0px 2px 0px inset',
            }}
            title={!sidebarOpen ? (isDark ? '切换到浅色，右键快捷更换主题' : '切换到深色，右键快捷更换主题') : '点击切换明暗，右键快捷更换主题'}
          >
            <div style={{ position: 'relative', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.05, type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Moon size={20} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.05, type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Sun size={24} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {sidebarOpen && (
              <AnimatePresence mode="wait">
                <motion.span
                  key={isDark ? 'dark' : 'light'}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                >
                  {isDark ? '深色模式' : '浅色模式'}
                </motion.span>
              </AnimatePresence>
            )}
          </motion.button>
        </div>

        {/* 展开/收起按钮 */}
        <div style={{ padding: '8px 8px', flexShrink: 0 }}>
          <Button
            type="text"
            icon={sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            onClick={(e) => { triggerKeyClickAnim(e); keyClick(); toggleSidebar(); }}
            className={!sidebarOpen ? 'sidebar-key-btn' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px',
              borderRadius: 8,
              color: 'var(--text-tertiary)',
              border: sidebarOpen
                ? '1px solid transparent'
                : '2px solid rgba(0, 0, 0, 0.12)',
              borderWidth: sidebarOpen ? '1px' : '2px 2px 4px',
              boxShadow: sidebarOpen
                ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.05), inset -2px -2px 5px rgba(255, 255, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.16) 0px 4px 0px, rgba(255, 255, 255, 0.2) 0px 2px 0px inset',
            }}
          />
        </div>
      </div>

      {/* 主题切换特效 */}
      <AnimatePresence>
        {isTransitioning && transitionDirection && (
          <>
            <motion.div
              key={`wave-${transitionDirection}-${transitionColor}`}
              initial={{ left: '-8%' }}
              animate={{ left: '108%' }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                width: 80,
                zIndex: 99992,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                inset: '-10% 0',
                transform: 'scaleX(1.03) skewX(-3deg)',
                background: `linear-gradient(90deg, transparent 0%, ${transitionColor}15 12%, ${transitionColor}44 28%, ${transitionColor}88 45%, #fff66 48%, #fffaa 50%, #fff66 52%, ${transitionColor}88 55%, ${transitionColor}44 72%, ${transitionColor}15 88%, transparent 100%)`,
                opacity: 0.35,
                filter: 'blur(0.5px)',
              }} />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 30%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 60%, transparent 100%)`,
              }} />
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.05))',
              }} />
              <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.1), transparent)',
              }} />
            </motion.div>
            <motion.div
              key={`wave-glow-${transitionDirection}`}
              initial={{ left: '-8%', opacity: 0.8 }}
              animate={{ left: '108%', opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                width: 160,
                zIndex: 99991,
                pointerEvents: 'none',
                background: `radial-gradient(ellipse at 50% 50%, ${transitionColor}33 0%, transparent 70%)`,
                filter: 'blur(20px)',
              }}
            />
          </>
        )}
      </AnimatePresence>
      
      </div>
    </Sider>
  );
};

export default Sidebar;
