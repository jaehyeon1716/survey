"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Download, Search, X, Users, BarChart3, FileText, Settings, Building, Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AnswerOption {
  text: string
  score: number
}

interface QuestionData {
  question: string
  answers: AnswerOption[]
}

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  survey_questions?: Array<{
    id: number
    question_text: string
    question_order: number
    answer_options?: AnswerOption[]
  }>
  participantCount?: number
}

interface Participant {
  id: number
  survey_id: number
  token: string
  hospital_name: string
  participant_name: string
  phone_number: string
  is_completed: boolean
  created_at: string
  completed_at?: string
}

interface SurveyResponse {
  id: number
  participant_id: number
  question_id: number
  answer_value: number
  answer_text: string
  created_at: string
  survey_participants?: {
    participant_name: string
    hospital_name: string
    phone_number: string
  }
}

interface QuestionStats {
  questionId: number
  questionText: string
  responseCount: number
  averageScore: number
  responses: Array<{
    value: number
    text: string
    count: number
  }>
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [activeTab, setActiveTab] = useState("create")
  const [hospitalFilter, setHospitalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [hospitalSearchFilter, setHospitalSearchFilter] = useState("")
  const [questionFilter, setQuestionFilter] = useState("")

  // 설문지 생성 관련 상태
  const [newSurveyTitle, setNewSurveyTitle] = useState("")
  const [newSurveyDescription, setNewSurveyDescription] = useState("")
  const [newSurveyQuestions, setNewSurveyQuestions] = useState<QuestionData[]>([
    {
      question: "",
      answers: [
        { text: "매우 그렇다", score: 5 },
        { text: "그렇다", score: 4 },
        { text: "보통이다", score: 3 },
        { text: "그렇지 않다", score: 2 },
        { text: "전혀 그렇지 않다", score: 1 },
      ],
    },
  ])
  const [createLoading, setCreateLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState("")

  // 삭제 관련 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deletePassword, setDeletePassword] = useState("")

  // CSV 업로드 관련 상태
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)

  const safeParticipants = Array.isArray(participants) ? participants : []
  const safeResponses = Array.isArray(responses) ? responses : []

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "hospital2024") {
      setIsAuthenticated(true)
      setError("")
      fetchSurveys()
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("surveys")
        .select(`
          *,
          survey_questions (
            id,
            question_text,
            question_order,
            answer_options
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      // 각 설문지의 참여자 수를 미리 계산
      const surveysWithParticipantCount = await Promise.all(
        (data || []).map(async (survey) => {
          const { count } = await supabase
            .from("survey_participants")
            .select("*", { count: "exact", head: true })
            .eq("survey_id", survey.id)

          return {
            ...survey,
            participantCount: count || 0,
          }
        }),
      )

      setSurveys(surveysWithParticipantCount)
    } catch (error) {
      console.error("설문지 조회 오류:", error)
      setError("설문지 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchParticipants = async (surveyId: number) => {
    try {
      const response = await fetch(`/api/admin/surveys/${surveyId}/participants`)
      if (!response.ok) throw new Error("Failed to fetch participants")
      const data = await response.json()
      setParticipants(data)
    } catch (error) {
      console.error("참여자 조회 오류:", error)
      setError("참여자 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchResponses = async (surveyId: number) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          *,
          survey_participants!inner (
            participant_name,
            hospital_name,
            phone_number,
            survey_id
          )
        `)
        .eq("survey_participants.survey_id", surveyId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setResponses(data || [])
    } catch (error) {
      console.error("응답 조회 오류:", error)
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchQuestionStats = async (surveyId: number, hospitalFilter = "") => {
    try {
      const supabase = createClient()

      let query = supabase
        .from("survey_responses")
        .select(`
          question_id,
          answer_value,
          answer_text,
          survey_questions!inner (
            question_text,
            question_order
          ),
          survey_participants!inner (
            hospital_name,
            survey_id
          )
        `)
        .eq("survey_participants.survey_id", surveyId)

      if (hospitalFilter) {
        query = query.ilike("survey_participants.hospital_name", `%${hospitalFilter}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // 문항별로 통계 계산
      const statsMap = new Map<number, QuestionStats>()

      data?.forEach((response) => {
        const questionId = response.question_id
        const questionText = response.survey_questions?.question_text || ""

        if (!statsMap.has(questionId)) {
          statsMap.set(questionId, {
            questionId,
            questionText,
            responseCount: 0,
            averageScore: 0,
            responses: [],
          })
        }

        const stat = statsMap.get(questionId)!
        stat.responseCount++

        // 응답별 카운트
        const existingResponse = stat.responses.find((r) => r.value === response.answer_value)
        if (existingResponse) {
          existingResponse.count++
        } else {
          stat.responses.push({
            value: response.answer_value,
            text: response.answer_text,
            count: 1,
          })
        }
      })

      // 평균 점수 계산
      statsMap.forEach((stat) => {
        const totalScore = stat.responses.reduce((sum, r) => sum + r.value * r.count, 0)
        stat.averageScore = stat.responseCount > 0 ? totalScore / stat.responseCount : 0
      })

      setQuestionStats(Array.from(statsMap.values()).sort((a, b) => a.questionId - b.questionId))
    } catch (error) {
      console.error("문항별 통계 조회 오류:", error)
      setQuestionStats([])
    }
  }

  // 설문지 선택 시 관련 데이터 로드
  useEffect(() => {
    if (selectedSurvey) {
      const loadSurveyData = async () => {
        try {
          await Promise.all([
            fetchParticipants(selectedSurvey.id),
            fetchResponses(selectedSurvey.id),
            fetchQuestionStats(selectedSurvey.id, hospitalSearchFilter),
          ])
        } catch (error) {
          console.error("[v0] 설문지 데이터 로딩 에러:", error)
          setError("설문지 데이터를 불러오는데 실패했습니다.")
        }
      }
      loadSurveyData()
    }
  }, [selectedSurvey])

  // 병원 검색 필터 변경 시 문항별 통계 다시 로드
  useEffect(() => {
    if (selectedSurvey && hospitalSearchFilter !== undefined) {
      const loadQuestionStats = async () => {
        try {
          await fetchQuestionStats(selectedSurvey.id, hospitalSearchFilter)
        } catch (error) {
          console.error("[v0] 문항별 통계 로딩 에러:", error)
        }
      }
      loadQuestionStats()
    }
  }, [hospitalSearchFilter, selectedSurvey])

  const addQuestion = () => {
    setNewSurveyQuestions([
      ...newSurveyQuestions,
      {
        question: "",
        answers: [
          { text: "매우 그렇다", score: 5 },
          { text: "그렇다", score: 4 },
          { text: "보통이다", score: 3 },
          { text: "그렇지 않다", score: 2 },
          { text: "전혀 그렇지 않다", score: 1 },
        ],
      },
    ])
  }

  const removeQuestion = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, question: string) => {
    const updated = [...newSurveyQuestions]
    updated[index].question = question
    setNewSurveyQuestions(updated)
  }

  const addAnswer = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push({ text: "", score: 1 })
    setNewSurveyQuestions(updated)
  }

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers.splice(answerIndex, 1)
      setNewSurveyQuestions(updated)
    }
  }

  const updateAnswer = (questionIndex: number, answerIndex: number, field: "text" | "score", value: string) => {
    const updated = [...newSurveyQuestions]
    if (field === "text") {
      updated[questionIndex].answers[answerIndex].text = value
    } else {
      updated[questionIndex].answers[answerIndex].score = Number.parseInt(value) || 1
    }
    setNewSurveyQuestions(updated)
  }

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSurveyTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    setCreateLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSurveyTitle,
          description: newSurveyDescription,
          questions: newSurveyQuestions,
        }),
      })

      if (!response.ok) throw new Error("설문지 저장 실패")

      setUploadSuccess("설문지가 성공적으로 생성되었습니다!")

      // 폼 초기화
      setNewSurveyTitle("")
      setNewSurveyDescription("")
      setNewSurveyQuestions([
        {
          question: "",
          answers: [
            { text: "매우 그렇다", score: 5 },
            { text: "그렇다", score: 4 },
            { text: "보통이다", score: 3 },
            { text: "그렇지 않다", score: 2 },
            { text: "전혀 그렇지 않다", score: 1 },
          ],
        },
      ])

      // 설문지 목록 새로고침
      fetchSurveys()

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("설문지 생성 오류:", error)
      setError("설문지 생성에 실패했습니다.")
    } finally {
      setCreateLoading(false)
    }
  }

  const deleteSurvey = async () => {
    if (!surveyToDelete || deletePassword !== "hospital2024") {
      setError("관리자 비밀번호가 올바르지 않습니다.")
      return
    }

    try {
      const response = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("삭제 실패")

      setUploadSuccess("설문지가 성공적으로 삭제되었습니다!")
      setShowDeleteConfirm(false)
      setSurveyToDelete(null)
      setDeletePassword("")
      fetchSurveys()

      if (selectedSurvey?.id === surveyToDelete.id) {
        setSelectedSurvey(null)
      }

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("설문지 삭제 오류:", error)
      setError("설문지 삭제에 실패했습니다.")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setCsvFile(file)
    } else {
      setError("CSV 파일만 업로드 가능합니다.")
    }
  }

  const handleUpload = async () => {
    if (!csvFile || !selectedSurvey) return

    setUploadLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", csvFile)

      const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("업로드 실패")

      setUploadSuccess("참여자가 성공적으로 업로드되었습니다!")
      setCsvFile(null)
      fetchParticipants(selectedSurvey.id)

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("CSV 업로드 오류:", error)
      setError("CSV 업로드에 실패했습니다.")
    } finally {
      setUploadLoading(false)
    }
  }

  // CSV 다운로드 함수들
  const downloadOverallStats = () => {
    if (!selectedSurvey) return

    const completedParticipants = safeParticipants.filter((p) => p.is_completed)
    const totalParticipants = safeParticipants.length
    const completionRate = totalParticipants > 0 ? (completedParticipants.length / totalParticipants) * 100 : 0

    // 전체 평균 점수 계산
    const totalScore = responses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
    const averageScore = completedParticipants.length > 0 ? totalScore / completedParticipants.length : 0

    const csvContent = [
      ["전체병원 통계"],
      ["설문지명", selectedSurvey.title],
      ["총 참여자수", totalParticipants.toString()],
      ["완료된 설문수", completedParticipants.length.toString()],
      ["완료율", `${completionRate.toFixed(1)}%`],
      ["전체 평균점수", `${averageScore.toFixed(1)}/5`],
      ["생성일", new Date(selectedSurvey.created_at).toLocaleDateString()],
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `전체병원통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadQuestionStats = () => {
    if (!selectedSurvey || questionStats.length === 0) return

    const csvContent = [
      ["전체병원 문항별통계"],
      ["문항", "응답수", "평균점수"],
      ...questionStats.map((stat) => [stat.questionText, stat.responseCount.toString(), stat.averageScore.toFixed(1)]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `전체병원문항별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadHospitalStats = () => {
    if (!selectedSurvey || participants.length === 0) return

    // 병원별 통계 계산
    const hospitalStats = participants.reduce(
      (acc, participant) => {
        const hospital = participant.hospital_name
        if (!acc[hospital]) {
          acc[hospital] = {
            total: 0,
            completed: 0,
            totalScore: 0,
          }
        }

        acc[hospital].total++
        if (participant.is_completed) {
          acc[hospital].completed++

          // 해당 참여자의 응답 점수 합계
          const participantResponses = safeResponses.filter(
            (r) =>
              r.survey_participants?.participant_name === participant.participant_name &&
              r.survey_participants?.hospital_name === hospital,
          )
          const participantScore = participantResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
          acc[hospital].totalScore += participantScore
        }

        return acc
      },
      {} as Record<string, { total: number; completed: number; totalScore: number }>,
    )

    const csvContent = [
      ["병원별통계"],
      ["병원명", "총대상자", "응답완료", "완료율", "평균점수"],
      ...Object.entries(hospitalStats).map(([hospital, stats]) => [
        hospital,
        stats.total.toString(),
        stats.completed.toString(),
        `${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%`,
        `${stats.completed > 0 ? (stats.totalScore / stats.completed).toFixed(1) : 0}/5`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `병원별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadHospitalDetailedStats = () => {
    if (!selectedSurvey || responses.length === 0) return

    // 병원별 문항별 상세 통계
    const detailedStats: Record<string, Record<string, { count: number; totalScore: number }>> = {}

    responses.forEach((response) => {
      const hospital = response.survey_participants?.hospital_name || "알 수 없음"
      const questionText =
        questionStats.find((q) => q.questionId === response.question_id)?.questionText || `문항 ${response.question_id}`

      if (!detailedStats[hospital]) {
        detailedStats[hospital] = {}
      }

      if (!detailedStats[hospital][questionText]) {
        detailedStats[hospital][questionText] = { count: 0, totalScore: 0 }
      }

      detailedStats[hospital][questionText].count++
      detailedStats[hospital][questionText].totalScore += response.answer_value || 0
    })

    const csvRows = [["병원별 문항별 상세통계"], ["병원명", "문항", "응답수", "평균점수"]]

    Object.entries(detailedStats).forEach(([hospital, questions]) => {
      Object.entries(questions).forEach(([question, stats]) => {
        csvRows.push([hospital, question, stats.count.toString(), (stats.totalScore / stats.count).toFixed(1)])
      })
    })

    const csvContent = csvRows.map((row) => row.join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `병원별문항별상세통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadParticipantsExcel = () => {
    if (!selectedSurvey || participants.length === 0) return

    const csvContent = [
      ["이름", "휴대폰번호", "병원이름", "토큰이포함된설문지주소"],
      ...participants.map((participant) => [
        participant.participant_name,
        participant.phone_number,
        participant.hospital_name,
        `${window.location.origin}/${participant.token}`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `참여자연락처_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setUploadSuccess("링크가 클립보드에 복사되었습니다!")
      setTimeout(() => setUploadSuccess(""), 2000)
    })
  }

  // 필터링된 참여자 목록
  const filteredParticipants = safeParticipants.filter((participant) => {
    const matchesHospital =
      hospitalFilter === "" || participant.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && participant.is_completed) ||
      (statusFilter === "incomplete" && !participant.is_completed)
    return matchesHospital && matchesStatus
  })

  // 병원별 통계 계산 (검색 필터 적용)
  const hospitalStats = participants.reduce(
    (acc, participant) => {
      const hospital = participant.hospital_name
      if (!acc[hospital]) {
        acc[hospital] = {
          total: 0,
          completed: 0,
          totalScore: 0,
        }
      }

      acc[hospital].total++
      if (participant.is_completed) {
        acc[hospital].completed++

        // 해당 참여자의 응답 점수 합계
        const participantResponses = safeResponses.filter(
          (r) =>
            r.survey_participants?.participant_name === participant.participant_name &&
            r.survey_participants?.hospital_name === hospital,
        )
        const participantScore = participantResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
        acc[hospital].totalScore += participantScore
      }

      return acc
    },
    {} as Record<string, { total: number; completed: number; totalScore: number }>,
  )

  // 검색된 병원 목록
  const filteredHospitals =
    hospitalStats && typeof hospitalStats === "object"
      ? Object.entries(hospitalStats).filter(([hospital]) =>
          hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
        )
      : []

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {!isAuthenticated && (
          <Card className="max-w-md mx-auto mt-20 shadow-lg border-0">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-semibold text-gray-800">관리자 로그인</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="관리자 비밀번호"
                  className="w-full h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  로그인
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-gray-200 pb-6">
              <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리</h1>
              <Button
                onClick={() => setIsAuthenticated(false)}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                로그아웃
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger
                  value="create"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  설문지 생성
                  {newSurveyQuestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 text-xs">
                      {newSurveyQuestions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="manage"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4" />
                  설문지 관리
                </TabsTrigger>
                <TabsTrigger
                  value="participants"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Users className="h-4 w-4" />
                  대상자 관리
                </TabsTrigger>
                <TabsTrigger
                  value="statistics"
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  통계
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-6 mt-8">
                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="border-b border-gray-100 bg-gray-50">
                    <CardTitle className="flex items-center justify-between text-xl text-gray-800">
                      새 설문지 생성
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleCreateSurvey} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">설문지 제목</label>
                          <Input
                            value={newSurveyTitle}
                            onChange={(e) => setNewSurveyTitle(e.target.value)}
                            placeholder="설문지 제목을 입력하세요"
                            className="w-full h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">설문지 설명</label>
                          <Textarea
                            value={newSurveyDescription}
                            onChange={(e) => setNewSurveyDescription(e.target.value)}
                            placeholder="설문지 설명을 입력하세요"
                            className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">설문 문항</h3>
                        {newSurveyQuestions.map((question, index) => (
                          <Card key={index} className="border-gray-200 shadow-sm">
                            <CardContent className="p-5">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <label className="block text-sm font-medium text-gray-700">문항 {index + 1}</label>
                                  {newSurveyQuestions.length > 1 && (
                                    <Button
                                      onClick={() => removeQuestion(index)}
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <Input
                                  value={question.question}
                                  onChange={(e) => updateQuestion(index, e.target.value)}
                                  placeholder={`문항 ${index + 1}을 입력하세요`}
                                  className="w-full h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                />

                                <div className="space-y-3">
                                  <label className="block text-sm font-medium text-gray-700">답변 옵션</label>
                                  {question.answers.map((answer, answerIndex) => (
                                    <div key={answerIndex} className="flex items-center gap-3">
                                      <Input
                                        value={answer.text}
                                        onChange={(e) => updateAnswer(index, answerIndex, "text", e.target.value)}
                                        placeholder={`답변 ${answerIndex + 1}`}
                                        className="flex-1 h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                      />
                                      <Input
                                        type="number"
                                        value={answer.score.toString()}
                                        onChange={(e) => updateAnswer(index, answerIndex, "score", e.target.value)}
                                        placeholder="점수"
                                        className="w-20 h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                        min="1"
                                        max="10"
                                      />
                                      {question.answers.length > 1 && (
                                        <Button
                                          onClick={() => removeAnswer(index, answerIndex)}
                                          variant="outline"
                                          size="sm"
                                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                  <Button
                                    onClick={() => addAnswer(index)}
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-gray-300 text-gray-600 hover:bg-gray-50"
                                  >
                                    답변 옵션 추가
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        <Button
                          onClick={addQuestion}
                          variant="outline"
                          className="w-full h-12 border-gray-300 text-gray-600 hover:bg-gray-50 bg-transparent"
                        >
                          문항 추가
                        </Button>
                      </div>

                      {error && (
                        <Alert variant="destructive" className="border-red-200 bg-red-50">
                          <AlertDescription className="text-red-700">{error}</AlertDescription>
                        </Alert>
                      )}

                      {uploadSuccess && (
                        <Alert className="border-green-200 bg-green-50">
                          <AlertDescription className="text-green-800">{uploadSuccess}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        type="submit"
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        disabled={createLoading}
                      >
                        {createLoading ? "처리 중..." : "설문지 생성"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manage" className="space-y-6">
                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="border-b border-gray-100 bg-gray-50">
                    <CardTitle className="text-xl font-semibold text-gray-800">설문지 관리</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {surveys.map((survey) => (
                        <Card
                          key={survey.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200 ${
                            selectedSurvey?.id === survey.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedSurvey(survey)}
                        >
                          <CardContent className="p-5">
                            <div className="space-y-3">
                              <div>
                                <h3 className="font-semibold text-lg truncate text-gray-800">{survey.title}</h3>
                                <p className="text-sm text-gray-600 line-clamp-2">{survey.description}</p>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">참여자: {survey.participantCount || 0}명</span>
                                <Badge variant={survey.is_active ? "default" : "secondary"}>
                                  {survey.is_active ? "활성" : "비활성"}
                                </Badge>
                              </div>

                              <div className="text-xs text-gray-400">
                                생성일: {new Date(survey.created_at).toLocaleDateString()}
                              </div>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSurveyToDelete(survey)
                                    setShowDeleteConfirm(true)
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  삭제
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {surveys.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        생성된 설문지가 없습니다. 새 설문지를 생성해보세요.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 삭제 확인 모달 */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4 shadow-lg border-0">
                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-2xl font-semibold text-red-600">설문지 삭제</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 px-6 pb-6">
                        <p className="text-gray-700">정말로 "{surveyToDelete?.title}" 설문지를 삭제하시겠습니까?</p>
                        <p className="text-sm text-red-600">이 작업은 되돌릴 수 없습니다.</p>
                        <Input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="관리자 비밀번호 확인"
                          className="w-full h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowDeleteConfirm(false)
                              setSurveyToDelete(null)
                              setDeletePassword("")
                            }}
                            variant="outline"
                            className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={deleteSurvey}
                            variant="destructive"
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium"
                          >
                            삭제
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="participants" className="space-y-6">
                {!selectedSurvey ? (
                  <Card className="shadow-sm border-gray-200">
                    <CardContent className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">설문지를 선택해주세요</h3>
                      <p className="text-gray-500 mb-4">대상자를 관리하려면 먼저 설문지를 선택해야 합니다.</p>
                      <Button
                        onClick={() => setActiveTab("manage")}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-12"
                      >
                        설문지 관리로 이동
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card className="shadow-sm border-gray-200">
                      <CardHeader className="border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl font-semibold text-gray-800">
                            대상자 관리 - {selectedSurvey.title}
                          </CardTitle>
                          <Button
                            onClick={() => {
                              setSelectedSurvey(null)
                              setActiveTab("manage")
                            }}
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            다른 설문지 선택
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6 p-6">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Card className="bg-blue-50 border-blue-200 shadow-sm">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
                              <div className="text-sm text-blue-600">총 대상자</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-green-50 border-green-200 shadow-sm">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {safeParticipants.filter((p) => p.is_completed).length}
                              </div>
                              <div className="text-sm text-green-600">완료</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-orange-50 border-orange-200 shadow-sm">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-orange-600">
                                {safeParticipants.filter((p) => !p.is_completed).length}
                              </div>
                              <div className="text-sm text-orange-600">미완료</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-purple-50 border-purple-200 shadow-sm">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {safeParticipants.length > 0
                                  ? (
                                      (safeParticipants.filter((p) => p.is_completed).length /
                                        safeParticipants.length) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %
                              </div>
                              <div className="text-sm text-purple-600">완료율</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* CSV 업로드 */}
                        <Card className="shadow-sm border-gray-200">
                          <CardHeader className="border-b border-gray-100 bg-gray-50">
                            <CardTitle className="text-lg font-semibold text-gray-800">참여자 일괄 업로드</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-medium mb-2 text-gray-700">CSV 파일 형식</h4>
                              <p className="text-sm text-gray-600 mb-2">각 줄에 다음 형식으로 입력해주세요:</p>
                              <code className="text-sm bg-white p-2 rounded border block">
                                병원이름|참여자이름|휴대폰번호
                              </code>
                              <p className="text-xs text-gray-500 mt-2">예: 서울병원|홍길동|010-1234-5678</p>
                            </div>

                            <div className="flex items-center gap-4">
                              <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="flex-1 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                              />
                              <Button
                                onClick={handleUpload}
                                disabled={!csvFile || uploadLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-12"
                              >
                                {uploadLoading ? "업로드 중..." : "업로드"}
                              </Button>
                            </div>

                            {csvFile && <p className="text-sm text-green-600">선택된 파일: {csvFile.name}</p>}
                          </CardContent>
                        </Card>

                        {/* 필터 */}
                        <div className="flex gap-4">
                          <Input
                            placeholder="병원명으로 검색"
                            value={hospitalFilter}
                            onChange={(e) => setHospitalFilter(e.target.value)}
                            className="flex-1 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border rounded-md border-gray-200"
                          >
                            <option value="all">전체</option>
                            <option value="completed">완료</option>
                            <option value="incomplete">미완료</option>
                          </select>
                        </div>

                        {/* 대상자 목록 */}
                        <Card className="shadow-sm border-gray-200">
                          <CardHeader className="border-b border-gray-100 bg-gray-50">
                            <CardTitle className="text-xl font-semibold text-gray-800">
                              대상자 목록 ({filteredParticipants.length}명)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-gray-600">이름</TableHead>
                                  <TableHead className="text-gray-600">휴대폰번호</TableHead>
                                  <TableHead className="text-gray-600">병원이름</TableHead>
                                  <TableHead className="text-gray-600">상태</TableHead>
                                  <TableHead className="text-gray-600">생성일</TableHead>
                                  <TableHead className="text-gray-600">작업</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredParticipants.map((participant) => (
                                  <TableRow key={participant.id}>
                                    <TableCell className="font-medium text-gray-700">
                                      {participant.participant_name}
                                    </TableCell>
                                    <TableCell className="text-gray-600">{participant.phone_number}</TableCell>
                                    <TableCell className="text-gray-600">{participant.hospital_name}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={participant.is_completed ? "default" : "secondary"}
                                        className={
                                          participant.is_completed
                                            ? "bg-green-100 text-green-800"
                                            : "bg-orange-100 text-orange-800"
                                        }
                                      >
                                        {participant.is_completed ? "완료" : "미완료"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-gray-600">
                                      {new Date(participant.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        onClick={() => copyToClipboard(participant.token)}
                                        variant="outline"
                                        size="sm"
                                        className="border-gray-300 text-gray-600 hover:bg-gray-50"
                                      >
                                        링크 복사
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {filteredParticipants.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                {participants.length === 0
                                  ? "등록된 대상자가 없습니다."
                                  : "검색 조건에 맞는 대상자가 없습니다."}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 응답 분석 */}
                        {responses.length > 0 && (
                          <Card className="shadow-sm border-gray-200">
                            <CardHeader className="border-b border-gray-100 bg-gray-50">
                              <CardTitle className="text-xl font-semibold text-gray-800">응답 분석</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <Card className="bg-blue-50 border-blue-200 shadow-sm">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-blue-600">{responses.length}</div>
                                    <div className="text-sm text-blue-600">총 응답 수</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-green-50 border-green-200 shadow-sm">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-green-600">
                                      {responses.length > 0
                                        ? (
                                            responses.reduce((sum, r) => sum + (r.answer_value || 0), 0) /
                                            responses.length
                                          ).toFixed(1)
                                        : 0}
                                    </div>
                                    <div className="text-sm text-green-600">평균 점수</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-purple-50 border-purple-200 shadow-sm">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-purple-600">
                                      {new Set(responses.map((r) => r.survey_participants?.hospital_name)).size}
                                    </div>
                                    <div className="text-sm text-purple-600">참여 병원 수</div>
                                  </CardContent>
                                </Card>
                              </div>

                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-gray-600">참여자명</TableHead>
                                    <TableHead className="text-gray-600">병원이름</TableHead>
                                    <TableHead className="text-gray-600">응답 수</TableHead>
                                    <TableHead className="text-gray-600">평균 점수</TableHead>
                                    <TableHead className="text-gray-600">응답일시</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(
                                    responses.reduce(
                                      (acc, response) => {
                                        const key = `${response.survey_participants?.participant_name}-${response.survey_participants?.hospital_name}`
                                        if (!acc[key]) {
                                          acc[key] = {
                                            name: response.survey_participants?.participant_name || "",
                                            hospital: response.survey_participants?.hospital_name || "",
                                            responses: [],
                                            date: response.created_at,
                                          }
                                        }
                                        acc[key].responses.push(response.answer_value || 0)
                                        return acc
                                      },
                                      {} as Record<string, any>,
                                    ),
                                  ).map(([key, data]) => (
                                    <TableRow key={key}>
                                      <TableCell className="font-medium text-gray-700">{data.name}</TableCell>
                                      <TableCell className="text-gray-600">{data.hospital}</TableCell>
                                      <TableCell className="text-gray-600">{data.responses.length}</TableCell>
                                      <TableCell className="text-gray-600">
                                        {(
                                          data.responses.reduce((sum: number, val: number) => sum + val, 0) /
                                          data.responses.length
                                        ).toFixed(1)}
                                      </TableCell>
                                      <TableCell className="text-gray-600">
                                        {new Date(data.date).toLocaleString()}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* 통계 탭 */}
              <TabsContent value="statistics" className="space-y-6">
                {!selectedSurvey ? (
                  <Card className="bg-white shadow-sm border border-gray-200">
                    <CardContent className="p-8 text-center">
                      <div className="text-gray-500">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium mb-2">통계를 보려면 설문지를 선택해주세요</p>
                        <p className="text-sm">설문지 관리 탭에서 설문지를 선택한 후 통계를 확인할 수 있습니다.</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* 전체 병원 합계 */}
                    <Card className="bg-white shadow-sm border border-gray-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-blue-600" />
                          전체 병원 합계
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const completedParticipants = safeParticipants.filter((p) => p.is_completed)
                          const totalParticipants = safeParticipants.length
                          const completionRate =
                            totalParticipants > 0 ? (completedParticipants.length / totalParticipants) * 100 : 0
                          const totalScore = safeResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
                          const averageScore =
                            completedParticipants.length > 0 ? totalScore / completedParticipants.length : 0

                          return (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                  {
                                    Object.keys(
                                      participants.reduce((acc, p) => ({ ...acc, [p.hospital_name]: true }), {}),
                                    ).length
                                  }
                                </div>
                                <div className="text-sm text-gray-600">참여 병원</div>
                              </div>
                              <div className="bg-green-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">{totalParticipants}</div>
                                <div className="text-sm text-gray-600">총 대상자</div>
                              </div>
                              <div className="bg-purple-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-purple-600">{completedParticipants.length}</div>
                                <div className="text-sm text-gray-600">응답 완료</div>
                              </div>
                              <div className="bg-orange-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-orange-600">{completionRate.toFixed(1)}%</div>
                                <div className="text-sm text-gray-600">완료율</div>
                              </div>
                              <div className="bg-red-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-red-600">{averageScore.toFixed(1)}/5</div>
                                <div className="text-sm text-gray-600">평균 점수</div>
                              </div>
                            </div>
                          )
                        })()}
                      </CardContent>
                    </Card>

                    {/* 병원별 통계 */}
                    <Card className="bg-white shadow-sm border border-gray-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <Building className="h-5 w-5 text-green-600" />
                          병원별 통계
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            placeholder="병원명 검색..."
                            value={hospitalSearchFilter}
                            onChange={(e) => setHospitalSearchFilter(e.target.value)}
                            className="max-w-xs h-9 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          />
                          {hospitalSearchFilter && (
                            <Button
                              onClick={() => setHospitalSearchFilter("")}
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 border-gray-200 text-gray-600 hover:bg-gray-50"
                            >
                              초기화
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {hospitalSearchFilter ? (
                          <div className="space-y-4">
                            {(() => {
                              const hospitalStats = participants.reduce(
                                (acc, participant) => {
                                  const hospital = participant.hospital_name
                                  if (!acc[hospital]) {
                                    acc[hospital] = {
                                      total: 0,
                                      completed: 0,
                                      totalScore: 0,
                                    }
                                  }

                                  acc[hospital].total++
                                  if (participant.is_completed) {
                                    acc[hospital].completed++
                                    const participantResponses = safeResponses.filter(
                                      (r) =>
                                        r.survey_participants?.participant_name === participant.participant_name &&
                                        r.survey_participants?.hospital_name === hospital,
                                    )
                                    const participantScore = participantResponses.reduce(
                                      (sum, r) => sum + (r.answer_value || 0),
                                      0,
                                    )
                                    acc[hospital].totalScore += participantScore
                                  }

                                  return acc
                                },
                                {} as Record<string, { total: number; completed: number; totalScore: number }>,
                              )

                              const filteredHospitals =
                                hospitalStats && typeof hospitalStats === "object"
                                  ? Object.entries(hospitalStats).filter(([hospital]) =>
                                      hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
                                    )
                                  : []

                              return (
                                <>
                                  <p className="text-sm text-gray-600 mb-4">
                                    검색 결과: {filteredHospitals.length}개 병원
                                  </p>
                                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {filteredHospitals.map(([hospital, stats]) => (
                                      <Card key={hospital} className="bg-gray-50 border border-gray-200">
                                        <CardContent className="p-4">
                                          <h4 className="font-medium text-gray-800 mb-3">{hospital}</h4>
                                          <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <span className="text-gray-600">총 대상자:</span>
                                              <span className="font-medium">{stats.total}명</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-600">응답 완료:</span>
                                              <span className="font-medium">{stats.completed}명</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-600">완료율:</span>
                                              <span className="font-medium">
                                                {stats.total > 0
                                                  ? ((stats.completed / stats.total) * 100).toFixed(1)
                                                  : 0}
                                                %
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-600">평균 점수:</span>
                                              <span className="font-medium">
                                                {stats.completed > 0
                                                  ? (stats.totalScore / stats.completed).toFixed(1)
                                                  : 0}
                                                /5
                                              </span>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>병원별 통계를 보려면 위의 검색창에서 병원명을 검색해 주세요.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 문항별 통계 */}
                    <Card className="bg-white shadow-sm border border-gray-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          문항별 통계
                          {hospitalSearchFilter && (
                            <span className="text-sm font-normal text-gray-500">({hospitalSearchFilter})</span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {questionStats.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-3 px-4 font-medium text-gray-700">문항</th>
                                  <th className="text-center py-3 px-4 font-medium text-gray-700">응답 수</th>
                                  <th className="text-center py-3 px-4 font-medium text-gray-700">평균 점수</th>
                                </tr>
                              </thead>
                              <tbody>
                                {questionStats.map((stat, index) => (
                                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 text-gray-800">
                                      {stat.questionText || `문항 ${stat.questionId}`}
                                    </td>
                                    <td className="py-3 px-4 text-center text-gray-600">{stat.responseCount}명</td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="font-medium text-gray-800">
                                        {typeof stat.averageScore === "number" ? stat.averageScore.toFixed(1) : "0.0"}/5
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>문항별 통계 데이터가 없습니다.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm border border-gray-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <Download className="h-5 w-5 text-indigo-600" />
                          통계 데이터 다운로드
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Button
                            onClick={downloadOverallStats}
                            className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            전체병원 통계
                          </Button>
                          <Button
                            onClick={downloadQuestionStats}
                            className="h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            전체병원 문항별통계
                          </Button>
                          <Button
                            onClick={downloadHospitalStats}
                            className="h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            병원별 통계
                          </Button>
                          <Button
                            onClick={downloadHospitalDetailedStats}
                            className="h-12 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            병원별 문항별 상세통계
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
