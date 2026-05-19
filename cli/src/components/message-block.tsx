import { TextAttributes } from '@opentui/core'
import { memo, useState } from 'react'

import { BlocksRenderer } from './blocks/blocks-renderer'
import { UserContentWithCopyButton } from './blocks/user-content-copy'
import { Button } from './button'
import { FileAttachmentCard } from './file-attachment-card'
import { ImageCard } from './image-card'
import { MessageFooter } from './message-footer'
import { TextAttachmentCard } from './text-attachment-card'
import { UserErrorBanner } from './user-error-banner'
import { ValidationErrorPopover } from './validation-error-popover'
import { useTheme } from '../hooks/use-theme'
import { useWhyDidYouUpdateById } from '../hooks/use-why-did-you-update'
import { isReasoningTextBlock } from '../utils/block-processor'
import { getCliEnv } from '../utils/env'
import { type MarkdownPalette } from '../utils/markdown-renderer'
import { formatCwd } from '../utils/path-helpers'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { FeedbackCategory } from '@codebuff/common/constants/feedback'

import type {
  ContentBlock,
  FileAttachment,
  ImageAttachment,
  TextAttachment,
  ChatMessageMetadata,
} from '../types/chat'
import type { ThemeColor } from '../types/theme-system'

interface MessageBlockProps {
  messageId: string
  blocks?: ContentBlock[]
  content: string
  isUser: boolean
  isAi: boolean
  isLoading: boolean
  timestamp: string
  isComplete?: boolean
  completionTime?: string
  credits?: number
  timerStartTime: number | null
  textColor?: ThemeColor
  timestampColor: string
  markdownOptions: { codeBlockWidth: number; palette: MarkdownPalette }
  availableWidth: number
  markdownPalette: MarkdownPalette
  onToggleCollapsed: (id: string) => void
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
  onFeedback?: (messageId: string) => void
  onCloseFeedback?: () => void
  validationErrors?: Array<{ id: string; message: string }>
  /** Runtime error to display in UI but NOT send to LLM */
  userError?: string
  onOpenFeedback?: (options?: {
    category?: FeedbackCategory
    footerMessage?: string
    errors?: Array<{ id: string; message: string }>
  }) => void
  attachments?: ImageAttachment[]
  textAttachments?: TextAttachment[]
  fileAttachments?: FileAttachment[]
  metadata?: ChatMessageMetadata
  isLastMessage?: boolean
}

const MessageAttachments = memo(({
  imageAttachments,
  textAttachments,
  fileAttachments,
}: {
  imageAttachments: ImageAttachment[]
  textAttachments: TextAttachment[]
  fileAttachments: FileAttachment[]
}) => {
  if (imageAttachments.length === 0 && textAttachments.length === 0 && fileAttachments.length === 0) {
    return null
  }

  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      {imageAttachments.map((attachment) => (
        <ImageCard
          key={attachment.path}
          image={attachment}
          showRemoveButton={false}
        />
      ))}
      {textAttachments.map((attachment) => (
        <TextAttachmentCard
          key={attachment.id}
          attachment={attachment}
          showRemoveButton={false}
        />
      ))}
      {fileAttachments.map((attachment) => (
        <FileAttachmentCard
          key={attachment.path}
          attachment={attachment}
          showRemoveButton={false}
        />
      ))}
    </box>
  )
})

export const MessageBlock = memo(({
  messageId,
  blocks,
  content,
  isUser,
  isAi,
  isLoading,
  timestamp,
  isComplete,
  completionTime,
  credits,
  timerStartTime,
  textColor,
  timestampColor,
  markdownOptions,
  availableWidth,
  markdownPalette,
  onToggleCollapsed,
  onBuildFast,
  onBuildMax,
  onBuildLite,
  onFeedback,
  onCloseFeedback,
  validationErrors,
  userError,
  onOpenFeedback,
  attachments,
  textAttachments,
  fileAttachments,
  metadata,
  isLastMessage,
}: MessageBlockProps) => {
  const [showValidationPopover, setShowValidationPopover] = useState(false)

  const bashCwd = metadata?.bashCwd ? formatCwd(metadata.bashCwd) : undefined

  useWhyDidYouUpdateById(
    'MessageBlock',
    messageId,
    {
      messageId,
      blocks,
      content,
      isUser,
      isAi,
      isLoading,
      timestamp,
      isComplete,
      completionTime,
      credits,
      timerStartTime,
      textColor,
      timestampColor,
      markdownOptions,
      availableWidth,
      markdownPalette,
      onToggleCollapsed,
      onBuildFast,
      onBuildMax,
      onBuildLite,
      onFeedback,
      onCloseFeedback,
      validationErrors,
      onOpenFeedback,
      metadata,
      isLastMessage,
    },
    {
      logLevel: 'debug',
      enabled: getCliEnv().CODEBUFF_PERF_TEST === 'true',
    },
  )

  const theme = useTheme()
  const resolvedTextColor = textColor ?? theme.foreground

  // For AI messages, split blocks so only the trailing prose run renders inside
  // the bordered panel. Thinking/tool/agent blocks render plain above it. If no
  // final prose block exists yet (still streaming, or pure tool turn), the
  // border is suppressed entirely — matches the user's request that only the
  // AI's textual reply gets the framed treatment.
  const lastProseBlockIdx =
    isAi && blocks
      ? (() => {
          for (let i = blocks.length - 1; i >= 0; i--) {
            const b = blocks[i]
            if (b.type === 'text' && !isReasoningTextBlock(b)) {
              return i
            }
          }
          return -1
        })()
      : -1
  const hasTrailingProse = lastProseBlockIdx >= 0
  const aiPrefaceBlocks =
    isAi && blocks && hasTrailingProse ? blocks.slice(0, lastProseBlockIdx) : null
  const aiTailBlocks =
    isAi && blocks && hasTrailingProse ? blocks.slice(lastProseBlockIdx) : null
  const aiBorderColor =
    theme.aiPanelBorder ?? theme.secondary ?? theme.aiLine ?? theme.foreground

  return (
    <box
      style={{
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* User message timestamp with error indicator (non-bash commands) */}
      {isUser && !bashCwd && (
        <box style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'none',
              fg: timestampColor,
            }}
          >
            {`[${timestamp}]`}
          </text>

          {validationErrors && validationErrors.length > 0 && (
            <Button
              onClick={() => setShowValidationPopover(!showValidationPopover)}
            >
              <text
                style={{
                  fg: theme.error,
                  wrapMode: 'none',
                }}
              >
                [!]
              </text>
            </Button>
          )}
        </box>
      )}

      {/* Bash command metadata header (timestamp + cwd) - copy button moved inline */}
      {bashCwd && (
        <box style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'none',
              fg: timestampColor,
            }}
          >
            {`[${timestamp}]`}
          </text>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'none',
              fg: theme.muted,
            }}
          >
            •
          </text>
          <text
            attributes={TextAttributes.DIM}
            style={{
              wrapMode: 'word',
              fg: theme.muted,
            }}
          >
            {bashCwd}
          </text>
        </box>
      )}

      {/* Show validation popover below timestamp when expanded */}
      {isUser &&
        !bashCwd &&
        validationErrors &&
        validationErrors.length > 0 &&
        showValidationPopover && (
          <box style={{ paddingTop: 1, paddingBottom: 1 }}>
            <ValidationErrorPopover
              errors={validationErrors}
              onOpenFeedback={onOpenFeedback}
              onClose={() => setShowValidationPopover(false)}
            />
          </box>
        )}

      <box style={{ flexDirection: 'column', gap: 1, width: '100%' }}>
        {blocks ? (
          <box
            style={{
              flexDirection: 'column',
              gap: 1,
              width: '100%',
            }}
          >
            {aiPrefaceBlocks && aiTailBlocks ? (
              <>
                {aiPrefaceBlocks.length > 0 && (
                  <BlocksRenderer
                    sourceBlocks={aiPrefaceBlocks}
                    messageId={messageId}
                    isLoading={isLoading}
                    isComplete={isComplete}
                    isUser={isUser}
                    textColor={resolvedTextColor}
                    availableWidth={availableWidth}
                    markdownPalette={markdownPalette}
                    onToggleCollapsed={onToggleCollapsed}
                    onBuildFast={onBuildFast}
                    onBuildMax={onBuildMax}
                    onBuildLite={onBuildLite}
                    isLastMessage={isLastMessage}
                    contentToCopy={undefined}
                  />
                )}
                <box
                  border
                  borderStyle="single"
                  borderColor={aiBorderColor}
                  customBorderChars={BORDER_CHARS}
                  style={{
                    flexDirection: 'column',
                    gap: 1,
                    width: '100%',
                    paddingLeft: 1,
                    paddingRight: 1,
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                >
                  <BlocksRenderer
                    sourceBlocks={aiTailBlocks}
                    messageId={messageId}
                    isLoading={isLoading}
                    isComplete={isComplete}
                    isUser={isUser}
                    textColor={resolvedTextColor}
                    availableWidth={availableWidth}
                    markdownPalette={markdownPalette}
                    onToggleCollapsed={onToggleCollapsed}
                    onBuildFast={onBuildFast}
                    onBuildMax={onBuildMax}
                    onBuildLite={onBuildLite}
                    isLastMessage={isLastMessage}
                    contentToCopy={undefined}
                  />
                  {userError && <UserErrorBanner error={userError} />}
                  <MessageFooter
                    messageId={messageId}
                    blocks={blocks}
                    content={content}
                    isLoading={isLoading}
                    isComplete={isComplete}
                    completionTime={completionTime}
                    credits={credits}
                    timerStartTime={timerStartTime}
                    onFeedback={onFeedback}
                    onCloseFeedback={onCloseFeedback}
                  />
                </box>
              </>
            ) : (
              <BlocksRenderer
                sourceBlocks={blocks}
                messageId={messageId}
                isLoading={isLoading}
                isComplete={isComplete}
                isUser={isUser}
                textColor={resolvedTextColor}
                availableWidth={availableWidth}
                markdownPalette={markdownPalette}
                onToggleCollapsed={onToggleCollapsed}
                onBuildFast={onBuildFast}
                onBuildMax={onBuildMax}
                onBuildLite={onBuildLite}
                isLastMessage={isLastMessage}
                contentToCopy={isUser ? content : undefined}
              />
            )}
          </box>
        ) : isAi ? (
          <box
            border
            borderStyle="single"
            borderColor={aiBorderColor}
            customBorderChars={BORDER_CHARS}
            style={{
              flexDirection: 'column',
              gap: 1,
              width: '100%',
              paddingLeft: 1,
              paddingRight: 1,
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <UserContentWithCopyButton
              content={content}
              messageId={messageId}
              isLoading={isLoading}
              isComplete={isComplete}
              isUser={isUser}
              textColor={resolvedTextColor}
              codeBlockWidth={markdownOptions.codeBlockWidth}
              palette={markdownOptions.palette}
              showCopyButton={isUser}
            />
            {userError && <UserErrorBanner error={userError} />}
            <MessageFooter
              messageId={messageId}
              blocks={blocks}
              content={content}
              isLoading={isLoading}
              isComplete={isComplete}
              completionTime={completionTime}
              credits={credits}
              timerStartTime={timerStartTime}
              onFeedback={onFeedback}
              onCloseFeedback={onCloseFeedback}
            />
          </box>
        ) : (
          <UserContentWithCopyButton
            content={content}
            messageId={messageId}
            isLoading={isLoading}
            isComplete={isComplete}
            isUser={isUser}
            textColor={resolvedTextColor}
            codeBlockWidth={markdownOptions.codeBlockWidth}
            palette={markdownOptions.palette}
            showCopyButton={isUser}
          />
        )}
        {/* Show attachments for user messages */}
        {isUser &&
          ((attachments && attachments.length > 0) ||
            (textAttachments && textAttachments.length > 0) ||
            (fileAttachments && fileAttachments.length > 0)) && (
            <MessageAttachments
              imageAttachments={attachments ?? []}
              textAttachments={textAttachments ?? []}
              fileAttachments={fileAttachments ?? []}
            />
          )}
      </box>

      {/* For pure tool turns (no trailing AI prose), render userError + footer
          outside the (suppressed) border so they still surface. */}
      {isAi && !aiTailBlocks && !!blocks && (
        <>
          {userError && <UserErrorBanner error={userError} />}
          <MessageFooter
            messageId={messageId}
            blocks={blocks}
            content={content}
            isLoading={isLoading}
            isComplete={isComplete}
            completionTime={completionTime}
            credits={credits}
            timerStartTime={timerStartTime}
            onFeedback={onFeedback}
            onCloseFeedback={onCloseFeedback}
          />
        </>
      )}
    </box>
  )
})
