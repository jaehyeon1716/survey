import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const { title, description, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json({ error: "제목과 문항은 필수입니다." }, { status: 400 })
    }

    const { error: surveyError } = await supabase
      .from("surveys")
      .update({
        title,
        description: description || "",
      })
      .eq("id", Number.parseInt(surveyId))

    if (surveyError) throw surveyError

    const { error: deleteError } = await supabase
      .from("survey_questions")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (deleteError) throw deleteError

    const questionsData = questions.map(
      (question: { text: string; type: string; responseScaleType?: string }, index: number) => ({
        survey_id: Number.parseInt(surveyId),
        question_number: index + 1,
        question_text: question.text,
        question_type: question.type || "objective",
        response_scale_type: question.responseScaleType || "agreement",
      }),
    )

    const { error: questionsError } = await supabase.from("survey_questions").insert(questionsData)

    if (questionsError) throw questionsError

    return NextResponse.json({
      message: "설문지가 성공적으로 수정되었습니다.",
    })
  } catch (error) {
    console.error("설문지 수정 오류:", error)
    return NextResponse.json({ error: "설문지 수정 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    // Step 1: Delete all responses for this survey's participants using subquery
    const { error: responsesError } = await supabase
      .from("survey_responses")
      .delete()
      .in(
        "participant_token",
        supabase.from("survey_participants").select("token").eq("survey_id", Number.parseInt(surveyId)),
      )

    if (responsesError) {
      console.error("[v0] 응답 삭제 오류:", responsesError)
      throw responsesError
    }

    // Step 2: Delete all participants for this survey
    const { error: participantsError } = await supabase
      .from("survey_participants")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (participantsError) {
      console.error("[v0] 참여자 삭제 오류:", participantsError)
      throw participantsError
    }

    // Step 3: Delete all questions for this survey
    const { error: questionsError } = await supabase
      .from("survey_questions")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (questionsError) {
      console.error("[v0] 문항 삭제 오류:", questionsError)
      throw questionsError
    }

    // Step 4: Delete the survey itself
    const { error: surveyError } = await supabase.from("surveys").delete().eq("id", Number.parseInt(surveyId))

    if (surveyError) {
      console.error("[v0] 설문지 삭제 오류:", surveyError)
      throw surveyError
    }

    console.log("[v0] 설문지 삭제 완료:", surveyId)

    return NextResponse.json({
      message: "설문지가 성공적으로 삭제되었습니다.",
    })
  } catch (error) {
    console.error("[v0] 설문지 삭제 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "설문지 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
