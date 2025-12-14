/**
 * YjsUpdatePreview Component
 *
 * Decodes and displays the contents of a Yjs update from a CRDT log record.
 * Shows what changed: inserted content, deleted ranges, etc.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper, Chip, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DataObjectIcon from '@mui/icons-material/DataObject';
import CommentIcon from '@mui/icons-material/Comment';
import * as Y from 'yjs';

export interface YjsUpdatePreviewProps {
  /** Raw Yjs update data */
  data: Uint8Array;
  /** Maximum height of the preview container */
  maxHeight?: number | undefined;
}

interface DecodedStruct {
  id: { client: number; clock: number };
  length: number;
  parent: string | { client: number; clock: number } | null;
  parentSub: string | null;
  content: unknown;
  info: number;
}

interface DecodedUpdate {
  structs: DecodedStruct[];
  ds: {
    clients: Map<number, { clock: number; len: number }[]>;
  };
}

/**
 * Get a human-readable description of struct content
 */
function describeContent(content: unknown): {
  type: string;
  value: string;
  icon: 'text' | 'object' | 'other';
} {
  if (!content || typeof content !== 'object') {
    return { type: 'unknown', value: String(content), icon: 'other' };
  }

  const c = content as Record<string, unknown>;

  // String content (text insertion)
  if ('str' in c && typeof c['str'] === 'string') {
    const str = c['str'];
    const preview = str.length > 100 ? str.slice(0, 100) + '...' : str;
    return { type: 'Text', value: preview, icon: 'text' };
  }

  // Type content (creating a new Y.Type like Y.Text, Y.Map, Y.Array)
  if ('type' in c) {
    const typeRef = c['type'] as { _map?: unknown; _start?: unknown } | undefined;
    if (typeRef?._map !== undefined) {
      return { type: 'Y.Map', value: 'New map created', icon: 'object' };
    }
    if (typeRef?._start !== undefined) {
      return { type: 'Y.Text/Array', value: 'New text/array created', icon: 'object' };
    }
    return { type: 'Y.Type', value: 'Type reference', icon: 'object' };
  }

  // JSON content
  if ('arr' in c && Array.isArray(c['arr'])) {
    const arr = c['arr'] as unknown[];
    const preview = JSON.stringify(arr).slice(0, 100);
    return { type: 'JSON', value: preview + (preview.length >= 100 ? '...' : ''), icon: 'object' };
  }

  // Embed content (like images)
  if ('embed' in c) {
    return { type: 'Embed', value: JSON.stringify(c['embed']).slice(0, 50), icon: 'object' };
  }

  // Format content (text formatting attributes)
  if ('key' in c && 'value' in c) {
    return {
      type: 'Format',
      value: `${String(c['key'])}: ${JSON.stringify(c['value'])}`,
      icon: 'text',
    };
  }

  // Binary content
  if ('buf' in c) {
    const buf = c['buf'] as Uint8Array;
    return { type: 'Binary', value: `${buf.length} bytes`, icon: 'other' };
  }

  // Deleted content marker
  if ('len' in c && typeof c['len'] === 'number') {
    return { type: 'Deleted', value: `${c['len']} items`, icon: 'other' };
  }

  return { type: 'Other', value: JSON.stringify(content).slice(0, 50), icon: 'other' };
}

/**
 * Get parent description
 */
function describeParent(parent: string | { client: number; clock: number } | null): string {
  if (parent === null) return 'root';
  if (typeof parent === 'string') return parent;
  return `item(${parent.client}:${parent.clock})`;
}

/**
 * Check if a struct involves comments
 */
function isCommentRelated(struct: DecodedStruct): boolean {
  const parent = struct.parent;
  if (typeof parent === 'string') {
    // Direct children of 'comments' map or thread submaps
    return parent === 'comments' || parent.startsWith('comment_');
  }
  // Check parentSub for comment-related keys
  if (struct.parentSub) {
    const sub = struct.parentSub.toLowerCase();
    return (
      sub === 'comments' ||
      sub === 'replies' ||
      sub === 'reactions' ||
      sub.includes('anchor') ||
      sub.includes('author') ||
      sub.includes('content') ||
      sub.includes('resolved')
    );
  }
  return false;
}

/**
 * Get comment operation description
 */
function describeCommentOperation(struct: DecodedStruct): string | null {
  if (!isCommentRelated(struct)) return null;

  const parentSub = struct.parentSub;
  if (parentSub === 'replies') return 'Reply added';
  if (parentSub === 'reactions') return 'Reaction added';
  if (parentSub === 'content') return 'Content updated';
  if (parentSub === 'resolved') return 'Resolution status changed';

  const parent = struct.parent;
  if (parent === 'comments') return 'New comment thread';

  return 'Comment data';
}

export const YjsUpdatePreview: React.FC<YjsUpdatePreviewProps> = ({ data, maxHeight = 300 }) => {
  const decoded = useMemo(() => {
    try {
      const result = Y.decodeUpdate(data) as DecodedUpdate;
      return { success: true as const, data: result };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Failed to decode update',
      };
    }
  }, [data]);

  if (!decoded.success) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          maxHeight,
          overflow: 'auto',
          bgcolor: 'grey.900',
        }}
      >
        <Typography variant="caption" color="error">
          Failed to decode Yjs update: {decoded.error}
        </Typography>
      </Paper>
    );
  }

  const { structs, ds } = decoded.data;
  const hasDeleteSet =
    ds.clients instanceof Map ? ds.clients.size > 0 : Object.keys(ds.clients).length > 0;
  const commentCount = structs.filter((s) => isCommentRelated(s)).length;

  return (
    <Paper
      variant="outlined"
      sx={{
        maxHeight,
        overflow: 'auto',
        bgcolor: 'grey.900',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'grey.700',
          position: 'sticky',
          top: 0,
          bgcolor: 'grey.900',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DataObjectIcon fontSize="small" sx={{ color: 'grey.500' }} />
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Yjs Update Details
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            size="small"
            icon={<AddIcon />}
            label={`${structs.length} struct${structs.length !== 1 ? 's' : ''}`}
            sx={{ height: 20, fontSize: '0.7rem' }}
            color="success"
            variant="outlined"
          />
          {hasDeleteSet && (
            <Chip
              size="small"
              icon={<DeleteIcon />}
              label="Has deletions"
              sx={{ height: 20, fontSize: '0.7rem' }}
              color="error"
              variant="outlined"
            />
          )}
          {commentCount > 0 && (
            <Chip
              size="small"
              icon={<CommentIcon />}
              label={`${commentCount} comment op${commentCount !== 1 ? 's' : ''}`}
              sx={{ height: 20, fontSize: '0.7rem' }}
              color="warning"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {structs.length === 0 && !hasDeleteSet ? (
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            Empty update (no changes)
          </Typography>
        ) : (
          <>
            {/* Structs (insertions/modifications) */}
            {structs.map((struct, index) => {
              const content = describeContent(struct.content);
              const parent = describeParent(struct.parent);
              const commentOp = describeCommentOperation(struct);
              const isComment = commentOp !== null;

              return (
                <Box
                  key={index}
                  sx={{
                    mb: 1.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: isComment ? 'rgba(255, 167, 38, 0.1)' : 'grey.800',
                    border: isComment ? '1px solid' : 'none',
                    borderColor: isComment ? 'warning.dark' : 'transparent',
                    '&:last-child': { mb: 0 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {isComment ? (
                      <CommentIcon fontSize="small" sx={{ color: 'warning.main' }} />
                    ) : content.icon === 'text' ? (
                      <TextFieldsIcon fontSize="small" sx={{ color: 'success.main' }} />
                    ) : content.icon === 'object' ? (
                      <DataObjectIcon fontSize="small" sx={{ color: 'info.main' }} />
                    ) : (
                      <AddIcon fontSize="small" sx={{ color: 'grey.500' }} />
                    )}
                    <Typography
                      variant="caption"
                      sx={{ color: isComment ? 'warning.main' : 'grey.400' }}
                    >
                      {isComment ? commentOp : content.type}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'grey.500', ml: 'auto' }}>
                      in {parent}
                      {struct.parentSub ? `.${struct.parentSub}` : ''}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      color: content.type === 'Text' ? 'success.light' : 'grey.300',
                    }}
                  >
                    {content.value}
                  </Typography>
                  {struct.length > 1 && (
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                      Length: {struct.length}
                    </Typography>
                  )}
                </Box>
              );
            })}

            {/* Delete set */}
            {hasDeleteSet && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                  <Typography variant="caption" color="error">
                    Deletions
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'grey.800',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'error.light',
                    }}
                  >
                    {/* Display delete set info */}
                    {ds.clients instanceof Map
                      ? Array.from(ds.clients.entries())
                          .map(([client, ranges]) => `Client ${client}: ${ranges.length} range(s)`)
                          .join(', ')
                      : Object.entries(ds.clients)
                          .map(
                            ([client, ranges]) =>
                              `Client ${client}: ${(ranges as unknown[]).length} range(s)`
                          )
                          .join(', ')}
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default YjsUpdatePreview;
