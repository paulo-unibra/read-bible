import vine from '@vinejs/vine'

export const createNoteValidator = vine.compile(
  vine.object({
    bookId: vine.number().min(1),
    bookName: vine.string().trim().minLength(1).maxLength(100),
    chapterNumber: vine.number().min(0),
    verseNumbers: vine.array(vine.number().min(1)),
    verseText: vine.string().trim().minLength(1),
    note: vine.string().trim().minLength(1),
    isPrivate: vine.boolean().optional(),
  })
)

export const updateNoteValidator = vine.compile(
  vine.object({
    note: vine.string().trim().minLength(1).optional(),
    isPrivate: vine.boolean().optional(),
  })
)
