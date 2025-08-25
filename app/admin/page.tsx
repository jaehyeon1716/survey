"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Download, Edit } from "lucide-react"
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
    question_number: number
    answer_options?: AnswerOption[]
  }>
  participantCount?: number // 미리 계산된 참여자 수를 저장하는 필드
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
  completed_at: string | null
}

interface SurveyResponse {
  id: number
  participant_token: string
  question_id: number
  response_value: number
  created_at: string
  survey_participants?: {
    hospital_name: string
    participant_name: string
    phone_number: string
    token: string
  }
  total_score: number
  max_possible_score: number
}

interface QuestionStat {
  id: number
  questionNumber: number
  questionText: string
  totalResponses: number
  averageScore: number
  maxScore: number
}

const ADMIN_PASSWORD = "hospital2024"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [newSurveyTitle, setNewSurveyTitle] = useState("")
  const [newSurveyDescription, setNewSurveyDescription] = useState("")
  const [newSurveyQuestions, setNewSurveyQuestions] = useState<
    { question: string; answers: { text: string; score: number }[] }[]
  >([
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

  const [isEditMode, setIsEditMode] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editSurveyTitle, setEditSurveyTitle] = useState("")
  const [editSurveyDescription, setEditSurveyDescription] = useState("")
  const [editSurveyQuestions, setEditSurveyQuestions] = useState<
    { question: string; answers: { text: string; score: number }[] }[]
  >([])

  const [activeTab, setActiveTab] = useState("create")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [hospitalSearchFilter, setHospitalSearchFilter] = useState("")
  const [participantFilter, setParticipantFilter] = useState("all")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [createLoading, setCreateLoading] = useState(false)

  const [hospitalFilter, setHospitalFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([])

  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showTokens, setShowTokens] = useState(false)

  const downloadOverallStats = () => {
    if (!selectedSurvey) {
      alert("설문지를 선택해주세요.")
      return
    }

    const surveyParticipants = participants.filter((p) => p.survey_id === selectedSurvey.id)
    const completedParticipants = surveyParticipants.filter((p) => p.is_completed)
    const totalResponses = responses.filter((r) =>
      surveyParticipants.some((p) => p.token === r.survey_participants?.token),
    )

    const totalScore = totalResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
    const averageScore =
      completedParticipants.length > 0 ? (totalScore / completedParticipants.length).toFixed(1) : "0.0"
    const completionRate =
      surveyParticipants.length > 0 ? Math.round((completedParticipants.length / surveyParticipants.length) * 100) : 0

    const headers = ["항목", "값"]
    const csvData = [
      ["설문지명", selectedSurvey.title],
      ["총 참여자 수", surveyParticipants.length],
      ["응답 완료자 수", completedParticipants.length],
      ["완료율", `${completionRate}%`],
      ["전체 평균 점수", `${averageScore}/5`],
      ["총 응답 수", totalResponses.length],
      ["생성일", new Date(selectedSurvey.created_at).toLocaleDateString()],
    ]

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `전체통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadQuestionStats = () => {
    if (!selectedSurvey || questionStats.length === 0) {
      alert("설문지를 선택하고 문항별 통계를 확인해주세요.")
      return
    }

    const headers = ["문항번호", "문항내용", "응답수", "평균점수"]
    const csvData = questionStats.map((stat) => [
      stat.questionNumber,
      stat.questionText || `문항 ${stat.questionNumber}`,
      stat.totalResponses,
      stat.averageScore.toFixed(1),
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `문항별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadHospitalDetailedStats = () => {
    if (!selectedSurvey || questionStats.length === 0) {
      alert("설문지를 선택하고 통계를 확인해주세요.")
      return
    }

    const surveyParticipants = participants.filter((p) => p.survey_id === selectedSurvey.id)
    const hospitals = [...new Set(surveyParticipants.map((p) => p.hospital_name))]

    const headers = ["병원명", "문항번호", "문항내용", "응답수", "평균점수"]
    const csvData: string[][] = []

    hospitals.forEach((hospital) => {
      const hospitalParticipants = surveyParticipants.filter((p) => p.hospital_name === hospital)
      const hospitalTokens = hospitalParticipants.map((p) => p.token)

      questionStats.forEach((stat) => {
        const hospitalResponses = responses.filter(
          (r) =>
            r.survey_questions?.question_order === stat.questionNumber &&
            hospitalTokens.includes(r.survey_participants?.token),
        )

        const responseCount = hospitalResponses.length
        const averageScore =
          responseCount > 0 ? hospitalResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0) / responseCount : 0

        csvData.push([
          hospital,
          stat.questionNumber.toString(),
          stat.questionText || `문항 ${stat.questionNumber}`,
          responseCount.toString(),
          averageScore.toFixed(1),
        ])
      })
    })

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `병원별문항별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`,
    )
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadParticipantsExcel = () => {
    if (!selectedSurvey) {
      alert("설문지를 선택해주세요.")
      return
    }

    const surveyParticipants = participants.filter((p) => p.survey_id === selectedSurvey.id)

    if (surveyParticipants.length === 0) {
      alert("다운로드할 참여자 데이터가 없습니다.")
      return
    }

    // Create CSV data in the exact format requested: 이름,휴대폰번호,병원이름,토큰이포함된설문지주소
    const headers = ["이름", "휴대폰번호", "병원이름", "토큰이포함된설문지주소"]

    const csvData = surveyParticipants.map((participant) => [
      participant.participant_name,
      participant.phone_number,
      participant.hospital_name,
      `${window.location.origin}/${participant.token}`,
    ])

    const csvContent = [headers, ...csvData]
      .map((row) =>
        row
          .map((field) => {
            const value = String(field || "")
            return value.includes(",") || value.includes('"') || value.includes("\n")
              ? `"${value.replace(/"/g, '""')}"`
              : value
          })
          .join(","),
      )
      .join("\n")

    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })

    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_참여자연락처_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadGuide = () => {
    const guideContent = `병원 만족도 조사 시스템 사용 가이드

1. 설문지 생성
   - 제목과 설명을 입력합니다
   - 질문을 추가하고 답변 옵션을 설정합니다
   - 각 답변 옵션에 점수를 부여할 수 있습니다

2. 설문지 관리
   - 생성된 설문지 목록을 확인할 수 있습니다
   - 각 설문지의 참여자 수와 상태를 모니터링합니다

3. 대상자 관리
   - 설문 참여자를 관리하고 현황을 확인할 수 있습니다
   - 참여자별 응답 상태를 모니터링합니다

4. 통계
   - 설문 응답 결과를 실시간으로 확인할 수 있습니다
   - 통계 데이터를 통해 만족도를 분석합니다`

    const blob = new Blob([guideContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "병원만족도조사_사용가이드.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "hospital2024") {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/surveys")
      const data = await response.json()

      if (response.ok) {
        const surveysWithParticipants = await Promise.all(
          (data.surveys || []).map(async (survey: any) => {
            // 각 설문지의 참여자 수를 미리 계산
            const participantsResponse = await fetch(`/api/admin/surveys/${survey.id}/participants`)
            const participantsData = await participantsResponse.json()

            return {
              ...survey,
              participantCount: participantsData.participants?.length || 0,
            }
          }),
        )
        setSurveys(surveysWithParticipants)
      } else {
        setError(data.error || "설문지 조회 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async (surveyId?: number) => {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from("survey_participants")
        .select("*")
        .eq("survey_id", surveyId || selectedSurvey?.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setParticipants(data || [])
    } catch (err) {
      console.error("참여자 데이터 조회 오류:", err)
    }
  }

  const fetchResponses = async (surveyId?: number) => {
    const supabase = createClient()

    setLoading(true)
    try {
      let query = supabase
        .from("survey_responses")
        .select(`
          *,
          survey_participants!inner (
            hospital_name,
            participant_name,
            phone_number,
            token
          ),
          survey_questions!inner (
            question_text,
            question_order
          )
        `)
        .order("created_at", { ascending: false })

      if (surveyId) {
        query = query.eq("survey_participants.survey_id", surveyId)
      }

      const { data, error } = await query

      if (error) throw error
      setResponses(data || [])

      if (surveyId) {
        await fetchQuestionStats(surveyId)
      }
    } catch (err) {
      console.error("응답 데이터 조회 오류:", err)
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionStats = async (surveyId: number, hospitalFilter?: string) => {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          question_id,
          answer_value,
          survey_questions!inner (
            id,
            question_text,
            question_order
          ),
          survey_participants!inner (
            survey_id,
            hospital_name
          )
        `)
        .eq("survey_participants.survey_id", surveyId)

      if (error) {
        console.error("문항별 통계 쿼리 에러:", error)
        throw error
      }

      if (!data || data.length === 0) {
        setQuestionStats([])
        return
      }

      let filteredData = data
      if (hospitalFilter && hospitalFilter.trim()) {
        filteredData = data.filter((response: any) =>
          response.survey_participants?.hospital_name?.toLowerCase().includes(hospitalFilter.toLowerCase()),
        )
      }

      // 문항별 통계 계산
      const questionStatsMap: Record<
        number,
        {
          id: number
          questionNumber: number
          questionText: string
          responses: number[]
          totalResponses: number
          totalScore: number
        }
      > = {}

      filteredData.forEach((response: any) => {
        const questionId = response.survey_questions?.id
        const questionOrder = response.survey_questions?.question_order || 0
        const questionText = response.survey_questions?.question_text || ""
        const responseValue = response.answer_value || 0

        if (!questionId || !responseValue) return // 유효하지 않은 데이터 스킵

        if (!questionStatsMap[questionId]) {
          questionStatsMap[questionId] = {
            id: questionId,
            questionNumber: questionOrder,
            questionText: questionText,
            responses: [],
            totalResponses: 0,
            totalScore: 0,
          }
        }

        questionStatsMap[questionId].responses.push(responseValue)
        questionStatsMap[questionId].totalResponses += 1
        questionStatsMap[questionId].totalScore += responseValue
      })

      // QuestionStat 형태로 변환
      const processedStats: QuestionStat[] = Object.values(questionStatsMap)
        .map((stat) => ({
          id: stat.id,
          questionNumber: stat.questionNumber,
          questionText: stat.questionText,
          totalResponses: stat.totalResponses,
          averageScore: stat.totalResponses > 0 ? stat.totalScore / stat.totalResponses : 0,
          maxScore: 5,
        }))
        .sort((a, b) => a.questionNumber - b.questionNumber)

      setQuestionStats(processedStats)
    } catch (err) {
      console.error("질문 통계 조회 오류:", err)
      setQuestionStats([])
      setError("문항별 통계를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurveyTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = newSurveyQuestions.filter((q) => q.question.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setCreateLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurveyTitle.trim(),
          description: newSurveyDescription.trim(),
          questions: validQuestions.map((q) => ({
            question: q.question.trim(),
            answers: q.answers.filter((a) => a.text.trim() !== ""),
          })),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다.")
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
        fetchSurveys()
      } else {
        setError(data.error || "설문지 생성 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setCreateLoading(false)
    }
  }

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
      const updated = newSurveyQuestions.filter((_, i) => i !== index)
      setNewSurveyQuestions(updated)
    }
  }

  const updateQuestion = (index: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[index].question = value
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

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    field: "text" | "score",
    value: string | number,
  ) => {
    const updated = [...newSurveyQuestions]
    if (field === "text") {
      updated[questionIndex].answers[answerIndex].text = value as string
    } else {
      updated[questionIndex].answers[answerIndex].score = Number(value)
    }
    setNewSurveyQuestions(updated)
  }

  const createSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurveyTitle,
          description: newSurveyDescription,
          questions: newSurveyQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다!")
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
        fetchSurveys()
      } else {
        setError(data.error || "설문지 생성 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const addQuestionOld = () => {
    setNewSurveyQuestions([
      ...newSurveyQuestions,
      { question: "", answers: ["매우 그렇다", "그렇다", "보통이다", "그렇지 않다", "전혀 그렇지 않다"] },
    ])
  }

  const removeQuestionOld = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestionOld = (index: number, field: "question" | "answers", value: string | string[]) => {
    const updated = [...newSurveyQuestions]
    if (field === "question") {
      updated[index].question = value as string
    } else {
      updated[index].answers = value as string[]
    }
    setNewSurveyQuestions(updated)
  }

  const addAnswerOld = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push("")
    setNewSurveyQuestions(updated)
  }

  const removeAnswerOld = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers = updated[questionIndex].answers.filter((_, i) => i !== answerIndex)
      setNewSurveyQuestions(updated)
    }
  }

  const updateAnswerOld = (questionIndex: number, answerIndex: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers[answerIndex] = value
    setNewSurveyQuestions(updated)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedFile(file)
      setError("")
    } else {
      setError("CSV 파일만 업로드 가능합니다.")
      setSelectedFile(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("파일을 선택해주세요.")
      return
    }

    if (!selectedSurvey) {
      setError("설문지를 선택해주세요.")
      return
    }

    setLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const formData = new FormData()
      formData.append("csvFile", selectedFile)

      const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadSuccess(result.message)
        setSelectedFile(null)
        const fileInput = document.getElementById("csvFile") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchParticipants(selectedSurvey.id)
      } else {
        setError(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("업로드 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (token: string) => {
    const surveyUrl = `${window.location.origin}/${token}`
    try {
      await navigator.clipboard.writeText(surveyUrl)
      alert("설문 링크가 클립보드에 복사되었습니다!")
    } catch (err) {
      alert("링크 복사에 실패했습니다.")
    }
  }

  const downloadCSV = () => {
    if (responses.length === 0) {
      alert("다운로드할 데이터가 없습니다.")
      return
    }

    const headers = ["병원명", "참여자명", "휴대폰번호", "총점", "최대점수", "완료일시"]

    const csvData = responses.map((response) => [
      response.survey_participants?.hospital_name || "",
      response.survey_participants?.participant_name || "",
      response.survey_participants?.phone_number || "",
      response.total_score || "",
      response.max_possible_score || "",
      new Date(response.created_at).toLocaleString("ko-KR"),
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `설문조사_결과_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openDetailModal = (response: SurveyResponse) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
  }

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setEditSurveyTitle(survey.title)
    setEditSurveyDescription(survey.description || "")

    // 기존 문항들을 수정용 상태로 복사
    if (survey.survey_questions && survey.survey_questions.length > 0) {
      const questions = survey.survey_questions.map((q) => ({
        question: q.question_text,
        answers: Array.isArray(q.answer_options)
          ? q.answer_options
          : [
              { text: "매우 그렇다", score: 5 },
              { text: "그렇다", score: 4 },
              { text: "보통이다", score: 3 },
              { text: "그렇지 않다", score: 2 },
              { text: "전혀 그렇지 않다", score: 1 },
            ],
      }))
      setEditSurveyQuestions(questions)
    } else {
      setEditSurveyQuestions([
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

    setIsEditMode(true)
    setActiveTab("create") // 생성 탭으로 이동하여 수정 UI 표시
  }

  const cancelEditSurvey = () => {
    setIsEditMode(false)
    setEditingSurvey(null)
    setEditSurveyTitle("")
    setEditSurveyDescription("")
    setEditSurveyQuestions([])
    setActiveTab("manage") // 관리 탭으로 돌아가기
  }

  const updateSurvey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingSurvey || !editSurveyTitle.trim() || editSurveyQuestions.length === 0) {
      alert("제목과 최소 1개의 문항이 필요합니다.")
      return
    }

    const hasEmptyQuestions = editSurveyQuestions.some((q) => !q.question.trim())
    if (hasEmptyQuestions) {
      alert("모든 문항에 질문 내용을 입력해주세요.")
      return
    }

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingSurvey.id,
          title: editSurveyTitle.trim(),
          description: editSurveyDescription.trim(),
          questions: editSurveyQuestions,
        }),
      })

      if (response.ok) {
        alert("설문지가 성공적으로 수정되었습니다!")
        await fetchSurveys()
        cancelEditSurvey()
      } else {
        const errorData = await response.json()
        alert(`설문지 수정 실패: ${errorData.error}`)
      }
    } catch (error) {
      console.error("설문지 수정 오류:", error)
      alert("설문지 수정 중 오류가 발생했습니다.")
    }
  }

  const addEditQuestion = () => {
    setEditSurveyQuestions([
      ...editSurveyQuestions,
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

  const removeEditQuestion = (index: number) => {
    if (editSurveyQuestions.length > 1) {
      const updated = editSurveyQuestions.filter((_, i) => i !== index)
      setEditSurveyQuestions(updated)
    }
  }

  const updateEditQuestion = (index: number, value: string) => {
    const updated = [...editSurveyQuestions]
    updated[index].question = value
    setEditSurveyQuestions(updated)
  }

  const addEditAnswer = (questionIndex: number) => {
    const updated = [...editSurveyQuestions]
    updated[questionIndex].answers.push({ text: "", score: 1 })
    setEditSurveyQuestions(updated)
  }

  const removeEditAnswer = (questionIndex: number, answerIndex: number) => {
    const updated = [...editSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers.splice(answerIndex, 1)
      setEditSurveyQuestions(updated)
    }
  }

  const updateEditAnswer = (
    questionIndex: number,
    answerIndex: number,
    field: "text" | "score",
    value: string | number,
  ) => {
    const updated = [...editSurveyQuestions]
    if (field === "text") {
      updated[questionIndex].answers[answerIndex].text = value as string
    } else {
      updated[questionIndex].answers[answerIndex].score = Number(value)
    }
    setEditSurveyQuestions(updated)
  }

  const filterParticipants = useCallback(() => {
    let filtered = [...participants]

    if (hospitalFilter) {
      filtered = filtered.filter((p) => p.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase()))
    }

    if (statusFilter !== "all") {
      const isCompleted = statusFilter === "completed"
      filtered = filtered.filter((p) => p.is_completed === isCompleted)
    }

    setFilteredParticipants(filtered)
  }, [participants, hospitalFilter, statusFilter])

  const startEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setEditSurveyTitle(survey.title)
    setEditSurveyDescription(survey.description || "")

    if (survey.survey_questions && survey.survey_questions.length > 0) {
      const questions = survey.survey_questions.map((q) => ({
        question: q.question_text,
        answers: Array.isArray(q.answer_options)
          ? q.answer_options
          : [
              { text: "매우 그렇다", score: 5 },
              { text: "그렇다", score: 4 },
              { text: "보통이다", score: 3 },
              { text: "그렇지 않다", score: 2 },
              { text: "전혀 그렇지 않다", score: 1 },
            ],
      }))
      setEditSurveyQuestions(questions)
    } else {
      setEditSurveyQuestions([
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

    setIsEditMode(true)
    setActiveTab("create") // 생성 탭으로 이동하여 수정 UI 표시
  }

  const deleteSurvey = async () => {
    if (!surveyToDelete || deletePassword !== ADMIN_PASSWORD) {
      alert("비밀번호가 올바르지 않거나 설문지를 선택하지 않았습니다.")
      return
    }

    setDeleteLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        alert("설문지가 성공적으로 삭제되었습니다!")
        fetchSurveys()
        setShowDeleteConfirm(false)
        setSurveyToDelete(null)
        setDeletePassword("")
      } else {
        const errorData = await response.json()
        setError(errorData.error || "설문지 삭제 중 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error("설문지 삭제 오류:", error)
      setError("설문지 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchSurveys()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (selectedSurvey) {
      fetchParticipants(selectedSurvey.id)
      fetchResponses(selectedSurvey.id)
    }
  }, [selectedSurvey])

  useEffect(() => {
    filterParticipants()
  }, [participants, hospitalFilter, statusFilter])

  return (
    <div className="p-4">
      {!isAuthenticated && (
        <div className="mb-4">
          <form onSubmit={handleLogin} className="flex flex-col space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit">로그인</Button>
          </form>
        </div>
      )}
      {isAuthenticated && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">설문지 생성</TabsTrigger>
            <TabsTrigger value="manage">설문지 관리</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>설문지 생성</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateSurvey} className="flex flex-col space-y-4">
                  <Input
                    value={newSurveyTitle}
                    onChange={(e) => setNewSurveyTitle(e.target.value)}
                    placeholder="설문지 제목"
                  />
                  <Textarea
                    value={newSurveyDescription}
                    onChange={(e) => setNewSurveyDescription(e.target.value)}
                    placeholder="설문지 설명"
                  />
                  {newSurveyQuestions.map((question, index) => (
                    <div key={index} className="flex flex-col space-y-2">
                      <Input
                        value={question.question}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                        placeholder={`문항 ${index + 1}`}
                      />
                      <div className="flex flex-col space-y-2">
                        {question.answers.map((answer, answerIndex) => (
                          <div key={answerIndex} className="flex items-center space-x-2">
                            <Input
                              value={answer.text}
                              onChange={(e) => updateAnswer(index, answerIndex, "text", e.target.value)}
                              placeholder={`답변 ${answerIndex + 1}`}
                            />
                            <Input
                              type="number"
                              value={answer.score.toString()}
                              onChange={(e) => updateAnswer(index, answerIndex, "score", e.target.value)}
                              placeholder="점수"
                            />
                          </div>
                        ))}
                        <Button onClick={() => addAnswer(index)} variant="outline">
                          답변 추가
                        </Button>
                        {newSurveyQuestions.length > 1 && (
                          <Button onClick={() => removeQuestion(index)} variant="outline" className="ml-auto">
                            문항 삭제
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button onClick={addQuestion} variant="outline">
                    문항 추가
                  </Button>
                  {createLoading && <p>설문지 생성 중...</p>}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {uploadSuccess && (
                    <Alert variant="success">
                      <AlertDescription>{uploadSuccess}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit">설문지 생성</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="manage">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-2">
                <Input
                  value={hospitalFilter}
                  onChange={(e) => setHospitalFilter(e.target.value)}
                  placeholder="병원명 검색"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border p-2 rounded"
                >
                  <option value="all">전체</option>
                  <option value="completed">완료</option>
                  <option value="incomplete">미완료</option>
                </select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>설문지명</TableHead>
                    <TableHead>참여자 수</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>작성일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surveys.map((survey) => (
                    <TableRow key={survey.id}>
                      <TableCell>{survey.title}</TableCell>
                      <TableCell>{survey.participantCount}</TableCell>
                      <TableCell>
                        <Badge variant={survey.is_active ? "success" : "default"}>
                          {survey.is_active ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(survey.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="flex items-center space-x-2">
                        <Button onClick={() => setSelectedSurvey(survey)} variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setSurveyToDelete(survey)
                            setShowDeleteConfirm(true)
                          }}
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {showDeleteConfirm && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50">
                  <div className="bg-white p-4 rounded flex flex-col space-y-4">
                    <p>정말로 설문지를 삭제하시겠습니까?</p>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="관리자 비밀번호"
                    />
                    <div className="flex justify-end space-x-2">
                      <Button onClick={() => setShowDeleteConfirm(false)} variant="outline">
                        취소
                      </Button>
                      <Button onClick={deleteSurvey} variant="destructive">
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {selectedSurvey && (
                <div className="mt-4">
                  <h2 className="text-xl font-bold">{selectedSurvey.title}</h2>
                  <p>{selectedSurvey.description}</p>
                  <div className="mt-4 flex items-center space-x-2">
                    <Button onClick={downloadOverallStats} variant="outline">
                      <Download className="h-4 w-4" />
                      전체 통계 다운로드
                    </Button>
                    <Button onClick={downloadQuestionStats} variant="outline">
                      <Download className="h-4 w-4" />
                      문항별 통계 다운로드
                    </Button>
                    <Button onClick={downloadHospitalDetailedStats} variant="outline">
                      <Download className="h-4 w-4" />
                      병원별 문항별 통계 다운로드
                    </Button>
                    <Button onClick={downloadParticipantsExcel} variant="outline">
                      <Download className="h-4 w-4" />
                      참여자 연락처 다운로드
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-bold">참여자 목록</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이름</TableHead>
                          <TableHead>휴대폰번호</TableHead>
                          <TableHead>병원이름</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParticipants.map((participant) => (
                          <TableRow key={participant.id}>
                            <TableCell>{participant.participant_name}</TableCell>
                            <TableCell>{participant.phone_number}</TableCell>
                            <TableCell>{participant.hospital_name}</TableCell>
                            <TableCell>
                              <Badge variant={participant.is_completed ? "success" : "default"}>
                                {participant.is_completed ? "완료" : "미완료"}
                              </Badge>
                            </TableCell>
                            <TableCell className="flex items-center space-x-2">
                              <Button onClick={() => copyToClipboard(participant.token)} variant="outline">
                                링크 복사
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-bold">응답 결과</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>참여자명</TableHead>
                          <TableHead>병원이름</TableHead>
                          <TableHead>총점</TableHead>
                          <TableHead>최대점수</TableHead>
                          <TableHead>완료일시</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.map((response) => (
                          <TableRow key={response.id}>
                            <TableCell>{response.survey_participants?.participant_name}</TableCell>
                            <TableCell>{response.survey_participants?.hospital_name}</TableCell>
                            <TableCell>{response.total_score}</TableCell>
                            <TableCell>{response.max_possible_score}</TableCell>
                            <TableCell>{new Date(response.created_at).toLocaleString("ko-KR")}</TableCell>
                            <TableCell>
                              <Button onClick={() => openDetailModal(response)} variant="outline">
                                상세보기
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
