const fs = require('fs');
const path = require('path');

// Read original backup from git or reconstruct
const dir = 'd:/WorkeSpaceCoding/java/githubstars/packages/frontend/src/pages/StarList';

const content = `import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import {
    Card, Input, Select, Button, Row, Col, Tag, Typography,
    Space, DatePicker, Collapse, App, Segmented, Switch,
} from 'antd'
import {
    ClearOutlined, DownloadOutlined, TranslationOutlined,
    CaretDownOutlined, AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import * as statsApi from '../../api'
import * as starsApi from '../../api'
import * as translateApi from '../../api'
import { TranslatePanel, TranslateProgressModal } from '../../components/translate'
import { StarStatsBar, StarRepoView } from '../../components/stars'
import type { GithubRepo, OverviewStatsDTO, LanguageStatsDTO, PageResult } from '../../types'
import { usePolling } from '../../hooks/usePolling'
import { useStarListParams, TIME_PRESETS } from './hooks/useStarListParams'
import { INITIAL_TASK_PROGRESS, type TaskProgress } from '../../constants'
import dayjs from '../../config/setupDayjs'

const { Title, Text } = Typography

const SORT_BY_OPTIONS = [
    { label: 'Star 数量', value: 'stars_count' },
    { label: 'Star 时间', value: 'starred_at' },
    { label: 'Fork 数量', value: 'forks_count' },
    { label: '最近更新', value: 'repo_updated_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]

const SORT_ORDER_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
]

const DATE_FIELD_OPTIONS = [
    { label: 'Star 时间', value: 'starred_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '更新时间', value: 'repo_updated_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]
`;
console.log('Phase1 done');
