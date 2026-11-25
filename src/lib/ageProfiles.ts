import type { AgeGroup } from './types'

export type AgeProfile = {
  id: AgeGroup
  label: string
  shortLabel: string
  title: string
  summary: string
  systemPrompt: string
  lessonTitle: string
  lessonHint: string
  coachTitle: string
  placeholder: string
  interactionHint: string
  welcomeCopy: string
  suggestions: string[]
  interaction: {
    maxVisibleLines: number
    suggestedReplyCount: number
    showRomanization: boolean
    enableFreeTyping: boolean
  }
}

export const AGE_PROFILES: Record<AgeGroup, AgeProfile> = {
  '3-6': {
    id: '3-6',
    label: '3–6 岁 · 小小探索家',
    shortLabel: '3–6 岁',
    title: '小小探索家',
    summary: '短句、重复、动作和表情更多',
    systemPrompt: '你是一位 3–6 岁儿童的粤语老师。每次只说一到两句很短的话，优先使用日常词语和拟声词。先用简单普通话解释，再给出粤语示范。多用鼓励、重复和想象游戏，不讨论危险、隐私或成人话题。不要要求孩子提供真实姓名、住址、学校或联系方式。',
    lessonTitle: '和小麦玩一玩粤语',
    lessonHint: '先听一个词，再跟着小麦做动作、说一遍。',
    coachTitle: '准备好玩一玩吗？',
    placeholder: '点击句子，或请家长帮忙输入',
    interactionHint: '单句 + 图片 + 动作',
    welcomeCopy: '和小麦一起听一听、说一说，在场景中练习粤语。',
    suggestions: ['早晨！', '这是什么？'],
    interaction: { maxVisibleLines: 2, suggestedReplyCount: 2, showRomanization: false, enableFreeTyping: false },
  },
  '6-12': {
    id: '6-12',
    label: '6–12 岁 · 小小探险家',
    shortLabel: '6–12 岁',
    title: '故事小记者',
    summary: '情景对话、粤拼和小任务',
    systemPrompt: '你是一位 6–12 岁儿童的粤语老师。用清晰、活泼的短对话教学，每次最多三到四句。先肯定孩子，再给一个可模仿的粤语句子；必要时提供粤拼和普通话解释。鼓励孩子围绕学校、家庭、运动、动物和兴趣展开，不索取真实个人信息。',
    lessonTitle: '和小麦一起说粤语',
    lessonHint: '先听一遍，再跟着小麦说一遍。',
    coachTitle: '准备好跟读了吗？',
    placeholder: '问问小麦：点讲“你好”？',
    interactionHint: '短对话 + 粤拼 + 提示',
    welcomeCopy: '和小麦一起听一听、说一说，在场景中练习粤语。',
    suggestions: ['帮我练习打招呼', '点讲“谢谢”？', '我想去球场'],
    interaction: { maxVisibleLines: 4, suggestedReplyCount: 3, showRomanization: true, enableFreeTyping: true },
  },
  '12-plus': {
    id: '12-plus',
    label: '12+ · 自由对话',
    shortLabel: '12+ 岁',
    title: '粤语表达家',
    summary: '自然表达、语气和文化背景',
    systemPrompt: '你是一位面向 12 岁以上学习者的粤语教练。允许较自然的自由对话，解释语气、词汇使用场景和粤拼。先回答问题，再指出一处更地道的表达。保持友好、清晰和适度简洁，不索取真实个人信息。',
    lessonTitle: '把粤语说得更自然',
    lessonHint: '你可以自由提问，小麦会根据上下文继续聊下去。',
    coachTitle: '想聊什么都可以',
    placeholder: '问问小麦：帮我练习点餐',
    interactionHint: '自由对话 + 纠音 + 解释',
    welcomeCopy: '和小麦自由聊一会儿，练习更自然的粤语表达。',
    suggestions: ['帮我练习点餐', '纠正这句粤语', '讲一个香港小故事'],
    interaction: { maxVisibleLines: 6, suggestedReplyCount: 4, showRomanization: true, enableFreeTyping: true },
  },
}

export function getAgeProfile(ageGroup: AgeGroup): AgeProfile {
  return AGE_PROFILES[ageGroup] ?? AGE_PROFILES['6-12']
}

