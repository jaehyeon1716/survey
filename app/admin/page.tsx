"use client"

import { CardDescription } from "@/components/ui/card"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, FileText, Users, BarChart3, Filter } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  }>
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
  averageScore: string
  maxScore: number
}

const ADMIN_PASSWORD = "hospital2024"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeTab, setActiveTab] = useState("create")

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

  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([])
  const [hospitalSearchFilter, setHospitalSearchFilter] = useState<string>("")

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editQuestions, setEditQuestions] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null)
  const [showTokens, setShowTokens] = useState(false)

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
        setSurveys(data.surveys || [])
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
          averageScore: stat.totalResponses > 0 ? (stat.totalScore / stat.totalResponses).toFixed(1) : "0",
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
    setEditTitle(survey.title)
    setEditDescription(survey.description || "")
    setEditQuestions(survey.survey_questions?.map((q) => q.question_text) || [""])
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = editQuestions.filter((q) => q.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setEditLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${editingSurvey?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          questions: validQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 수정되었습니다.")
        setShowEditModal(false)
        setEditingSurvey(null)
        fetchSurveys()
        if (selectedSurvey?.id === editingSurvey?.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 수정 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 수정 중 오류가 발생했습니다.")
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = (survey: Survey) => {
    setSurveyToDelete(survey)
    setShowDeleteConfirm(true)
  }

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) return

    if (deletePassword !== ADMIN_PASSWORD) {
      setError("비밀번호가 올바르지 않습니다.")
      return
    }

    setDeleteLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 삭제되었습니다.")
        setShowDeleteConfirm(false)
        setSurveyToDelete(null)
        setDeletePassword("")
        fetchSurveys()
        if (selectedSurvey?.id === surveyToDelete.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 삭제 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const addEditQuestion = () => {
    setEditQuestions([...editQuestions, ""])
  }

  const removeEditQuestion = (index: number) => {
    if (editQuestions.length > 1) {
      setEditQuestions(editQuestions.filter((_, i) => i !== index))
    }
  }

  const updateEditQuestion = (index: number, value: string) => {
    const updated = [...editQuestions]
    updated[index] = value
    setEditQuestions(updated)
  }

  const filterParticipants = useCallback(() => {
    let filtered = participants

    if (hospitalFilter.trim()) {
      filtered = filtered.filter((p) => p.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase()))
    }

    if (statusFilter !== "all") {
      const isCompleted = statusFilter === "completed"
      filtered = filtered.filter((p) => p.is_completed === isCompleted)
    }

    setFilteredParticipants(filtered)
  }, [participants, hospitalFilter, statusFilter])

  const downloadStatsExcel = async () => {
    if (!selectedSurvey || responses.length === 0) {
      alert("다운로드할 통계 데이터가 없습니다.")
      return
    }

    const hospitalQuestionStats: Record<string, Record<number, any>> = {}

    try {
      const supabase = createClient()
      const { data: detailedResponses, error } = await supabase
        .from("survey_responses")
        .select(`
          question_id,
          answer_value,
          survey_questions (
            question_text,
            question_order
          ),
          survey_participants!inner (
            hospital_name
          )
        `)
        .in(
          "question_id",
          questionStats.map((q) => q.id),
        )

      if (!error && detailedResponses) {
        detailedResponses.forEach((response: any) => {
          const hospital = response.survey_participants?.hospital_name || "알 수 없음"
          const questionId = response.question_id
          const questionNumber = response.survey_questions?.question_order || 0
          const questionText = response.survey_questions?.question_text || ""

          if (!hospitalQuestionStats[hospital]) {
            hospitalQuestionStats[hospital] = {}
          }

          if (!hospitalQuestionStats[hospital][questionId]) {
            hospitalQuestionStats[hospital][questionId] = {
              questionNumber,
              questionText,
              responses: [],
              total: 0,
              count: 0,
            }
          }

          hospitalQuestionStats[hospital][questionId].responses.push(response.answer_value)
          hospitalQuestionStats[hospital][questionId].total += response.answer_value
          hospitalQuestionStats[hospital][questionId].count += 1
        })
      }
    } catch (err) {
      console.error("병원별 문항별 통계 조회 오류:", err)
    }

    const completedParticipants = participants.filter((p) => p.is_completed).length

    const totalScore = responses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
    const averageScore = responses.length > 0 ? (totalScore / responses.length).toFixed(1) : "0"

    const basicStats = [
      ["통계 항목", "값"],
      ["설문지 제목", selectedSurvey.title],
      ["총 참여자 수", participants.length.toString()],
      ["완료된 설문 수", completedParticipants.toString()], // 완료된 참여자 수로 수정
      ["완료율", `${participants.length > 0 ? Math.round((completedParticipants / participants.length) * 100) : 0}%`], // 올바른 완료율 계산
      [
        "전체 평균 점수",
        responses.length > 0 ? `${averageScore}/5` : "0", // answer_value 기반 평균 점수
      ],
      [""],
    ]

    const questionStatsData = [
      ["문항별 통계"],
      ["문항 번호", "문항 내용", "응답 수", "평균 점수"],
      ...questionStats.map((stat) => [
        stat.questionNumber.toString(),
        stat.questionText,
        stat.totalResponses.toString(),
        `${stat.averageScore}/${stat.maxScore}`,
      ]),
      [""],
    ]

    const hospitalStats = responses.reduce((acc: Record<string, any>, response) => {
      const hospital = response.survey_participants?.hospital_name || "알 수 없음"
      if (!acc[hospital]) {
        acc[hospital] = { count: 0, totalScore: 0, maxScore: 5 }
      }
      acc[hospital].count += 1
      acc[hospital].totalScore += response.answer_value || 0 // answer_value 사용
      return acc
    }, {})

    const hospitalStatsData = [
      ["병원별 통계"],
      ["병원명", "응답 수", "평균 점수"],
      ...Object.entries(hospitalStats).map(([hospital, stats]: [string, any]) => [
        hospital,
        stats.count.toString(),
        `${(stats.totalScore / stats.count).toFixed(1)}/${stats.maxScore}`,
      ]),
      [""],
    ]

    const hospitalQuestionStatsData = [
      ["병원별 문항별 상세 통계"],
      ["병원명", "문항 번호", "문항 내용", "응답 수", "평균 점수"],
    ]

    Object.keys(hospitalQuestionStats)
      .sort()
      .forEach((hospital) => {
        const hospitalData = hospitalQuestionStats[hospital]

        const sortedQuestions = Object.values(hospitalData).sort(
          (a: any, b: any) => a.questionNumber - b.questionNumber,
        )

        sortedQuestions.forEach((questionData: any) => {
          const average = questionData.count > 0 ? (questionData.total / questionData.count).toFixed(1) : "0"
          hospitalQuestionStatsData.push([
            hospital,
            questionData.questionNumber.toString(),
            questionData.questionText,
            questionData.count.toString(),
            `${average}/5`,
          ])
        })

        const hospitalTotalStats = hospitalStats[hospital]
        if (hospitalTotalStats) {
          hospitalQuestionStatsData.push([
            hospital,
            "전체",
            "모든 문항 평균",
            hospitalTotalStats.count.toString(),
            `${(hospitalTotalStats.totalScore / hospitalTotalStats.count).toFixed(1)}/${hospitalTotalStats.maxScore}`,
          ])
        }

        hospitalQuestionStatsData.push(["", "", "", "", ""])
      })

    const allData = [...basicStats, ...questionStatsData, ...hospitalStatsData, ...hospitalQuestionStatsData]

    const csvContent = allData.map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_통계_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    if (selectedSurvey) {
      fetchQuestionStats(selectedSurvey.id, hospitalSearchFilter)
    }
  }, [selectedSurvey, hospitalSearchFilter])

  useEffect(() => {
    setHospitalFilter(hospitalSearchFilter)
  }, [hospitalSearchFilter])

  useEffect(() => {
    filterParticipants()
  }, [filterParticipants])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">관리자 로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-lg font-medium">
                  비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 text-lg"
                  placeholder="관리자 비밀번호를 입력하세요"
                  required
                />
              </div>
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700">
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리 시스템</h1>
          <div className="flex items-center gap-4">
            <Button onClick={downloadGuide} variant="outline" className="flex items-center space-x-2 bg-transparent">
              <FileText className="w-4 h-4" />
              <span>사용 가이드</span>
            </Button>
            <Button onClick={() => setIsAuthenticated(false)} variant="outline">
              로그아웃
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {uploadSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{uploadSuccess}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">설문지 생성</TabsTrigger>
            <TabsTrigger value="manage">설문지 관리</TabsTrigger>
            <TabsTrigger value="participants">대상자 관리</TabsTrigger>
            <TabsTrigger value="statistics">통계</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center justify-between">
                  새 설문지 생성
                  <span className="text-sm font-normal bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                    문항 {newSurveyQuestions.length}개
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createSurvey} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="title" className="text-lg font-medium">
                        설문지 제목 *
                      </Label>
                      <Input
                        id="title"
                        value={newSurveyTitle}
                        onChange={(e) => setNewSurveyTitle(e.target.value)}
                        placeholder="예: 2024년 병원 만족도 조사"
                        className="mt-2 h-12 text-lg"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description" className="text-lg font-medium">
                        설명
                      </Label>
                      <Textarea
                        id="description"
                        value={newSurveyDescription}
                        onChange={(e) => setNewSurveyDescription(e.target.value)}
                        placeholder="설문지에 대한 간단한 설명을 입력하세요"
                        className="mt-2 min-h-[48px] text-lg"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">설문 문항 및 답변 옵션</Label>
                      <Button type="button" onClick={addQuestion} size="sm" className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        문항 추가
                      </Button>
                    </div>

                    {newSurveyQuestions.map((questionData, questionIndex) => (
                      <Card key={questionIndex} className="p-4 border-l-4 border-blue-500">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">문항 {questionIndex + 1}</Label>
                            {newSurveyQuestions.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeQuestion(questionIndex)}
                                size="sm"
                                variant="destructive"
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                삭제
                              </Button>
                            )}
                          </div>

                          <div>
                            <Label htmlFor={`question-${questionIndex}`}>질문 내용 *</Label>
                            <Textarea
                              id={`question-${questionIndex}`}
                              value={questionData.question}
                              onChange={(e) => updateQuestion(questionIndex, e.target.value)}
                              placeholder="예: 의료진의 친절도에 만족하십니까?"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">답변 옵션</Label>
                              <Button
                                type="button"
                                onClick={() => addAnswer(questionIndex)}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                답변 추가
                              </Button>
                            </div>

                            {questionData.answers.map((answer, answerIndex) => (
                              <div key={answerIndex} className="flex items-center gap-2">
                                <span className="text-sm font-medium w-8">{answerIndex + 1}.</span>
                                <Input
                                  value={answer.text}
                                  onChange={(e) => updateAnswer(questionIndex, answerIndex, "text", e.target.value)}
                                  placeholder={`답변 옵션 ${answerIndex + 1}`}
                                  className="flex-1"
                                />
                                <div className="flex items-center gap-1">
                                  <Label className="text-sm">점수:</Label>
                                  <Input
                                    type="number"
                                    value={answer.score}
                                    onChange={(e) => updateAnswer(questionIndex, answerIndex, "score", e.target.value)}
                                    className="w-16"
                                    min="1"
                                    max="10"
                                  />
                                </div>
                                {questionData.answers.length > 1 && (
                                  <Button
                                    type="button"
                                    onClick={() => removeAnswer(questionIndex, answerIndex)}
                                    size="sm"
                                    variant="ghost"
                                    className="p-1 h-8 w-8"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? "생성 중..." : "설문지 생성"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">설문지 관리</CardTitle>
                </CardHeader>
                <CardContent>
                  {surveys.length === 0 ? (
                    <Alert>
                      <AlertDescription>생성된 설문지가 없습니다.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {surveys.map((survey) => (
                        <Card
                          key={survey.id}
                          className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            selectedSurvey?.id === survey.id
                              ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200"
                              : "hover:border-gray-300"
                          }`}
                          onClick={() => setSelectedSurvey(survey)}
                        >
                          <CardHeader>
                            <CardTitle className="text-lg font-semibold">{survey.title}</CardTitle>
                            <CardDescription>{survey.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-2">
                            <Badge variant="secondary">
                              참여자 수: {participants.filter((p) => p.survey_id === survey.id).length}
                            </Badge>
                            <Badge variant="outline">상태: {survey.is_active ? "활성" : "비활성"}</Badge>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteConfirm(survey)
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSurvey && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold">선택된 설문지: {selectedSurvey.title}</CardTitle>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedSurvey(null)
                          setActiveTab("manage")
                        }}
                      >
                        다른 설문지 선택
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="font-medium">설명:</Label>
                      <p className="text-gray-600 mt-1">{selectedSurvey.description || "설명이 없습니다."}</p>
                    </div>

                    <div>
                      <Label className="font-medium">생성일:</Label>
                      <p className="text-gray-600 mt-1">
                        {new Date(selectedSurvey.created_at).toLocaleString("ko-KR")}
                      </p>
                    </div>

                    <div>
                      <Label className="font-medium">참여자 현황:</Label>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id).length}
                          </div>
                          <div className="text-sm text-blue-600">총 참여자</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed).length}
                          </div>
                          <div className="text-sm text-green-600">완료된 응답</div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <Label className="font-medium text-lg">참여자 CSV 업로드</Label>
                      <div className="mt-3 space-y-3">
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <strong>CSV 파일 형식:</strong> 병원이름|사람이름|휴대폰번호
                          </p>
                          <p className="text-sm text-yellow-800 mt-1">예시: 서울대병원|홍길동|010-1234-5678</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <Input
                            id="csvFile"
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="flex-1"
                          />
                          <Button
                            onClick={handleUpload}
                            disabled={!selectedFile || loading}
                            className="whitespace-nowrap"
                          >
                            {loading ? "업로드 중..." : "업로드"}
                          </Button>
                        </div>

                        {selectedFile && <p className="text-sm text-gray-600">선택된 파일: {selectedFile.name}</p>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => downloadParticipantsExcel()} className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        참여자 목록 다운로드
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="participants">
            <div className="space-y-6">
              {!selectedSurvey ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <Users className="w-6 h-6" />
                      대상자 관리
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertDescription>
                        설문지 관리 탭에서 설문지를 선택하면 해당 설문지의 대상자를 관리할 수 있습니다.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* 선택된 설문지 정보 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-semibold flex items-center gap-2">
                          <Users className="w-6 h-6" />
                          {selectedSurvey.title} - 대상자 관리
                        </CardTitle>
                        <Button variant="outline" onClick={() => setSelectedSurvey(null)}>
                          다른 설문지 선택
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id).length}
                          </div>
                          <div className="text-sm text-blue-600">총 대상자</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed).length}
                          </div>
                          <div className="text-sm text-green-600">응답 완료</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id && !p.is_completed).length}
                          </div>
                          <div className="text-sm text-orange-600">응답 미완료</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id).length > 0
                              ? Math.round(
                                  (participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed)
                                    .length /
                                    participants.filter((p) => p.survey_id === selectedSurvey.id).length) *
                                    100,
                                )
                              : 0}
                            %
                          </div>
                          <div className="text-sm text-purple-600">완료율</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 필터 및 검색 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        필터 및 검색
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="hospitalFilter">병원명 검색</Label>
                          <Input
                            id="hospitalFilter"
                            value={hospitalFilter}
                            onChange={(e) => setHospitalFilter(e.target.value)}
                            placeholder="병원명을 입력하세요"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="statusFilter">응답 상태</Label>
                          <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="mt-1 w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="all">전체</option>
                            <option value="completed">응답 완료</option>
                            <option value="pending">응답 미완료</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={() => {
                              setHospitalFilter("")
                              setStatusFilter("all")
                            }}
                            variant="outline"
                            className="w-full"
                          >
                            필터 초기화
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 대상자 목록 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold">대상자 목록</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => downloadParticipantsExcel()}
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            목록 다운로드
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {filteredParticipants.filter((p) => p.survey_id === selectedSurvey.id).length === 0 ? (
                        <Alert>
                          <AlertDescription>조건에 맞는 대상자가 없습니다.</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-gray-300 px-4 py-2 text-left">병원명</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">참여자명</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">휴대폰번호</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">상태</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">등록일</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">완료일</th>
                                <th className="border border-gray-300 px-4 py-2 text-center">설문 링크</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredParticipants
                                .filter((p) => p.survey_id === selectedSurvey.id)
                                .map((participant) => (
                                  <tr key={participant.id} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-4 py-2">{participant.hospital_name}</td>
                                    <td className="border border-gray-300 px-4 py-2">{participant.participant_name}</td>
                                    <td className="border border-gray-300 px-4 py-2">{participant.phone_number}</td>
                                    <td className="border border-gray-300 px-4 py-2">
                                      <Badge
                                        variant={participant.is_completed ? "default" : "secondary"}
                                        className={
                                          participant.is_completed
                                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                                            : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                                        }
                                      >
                                        {participant.is_completed ? "완료" : "미완료"}
                                      </Badge>
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2">
                                      {new Date(participant.created_at).toLocaleDateString("ko-KR")}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2">
                                      {participant.completed_at
                                        ? new Date(participant.completed_at).toLocaleDateString("ko-KR")
                                        : "-"}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(participant.token)}
                                      >
                                        링크 복사
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 응답 분석 섹션이 제거되었습니다. 통계 탭에서 확인 가능합니다. */}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="statistics">
            <div className="space-y-6">
              {!selectedSurvey ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <BarChart3 className="w-6 h-6" />
                      통계
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertDescription>
                        설문지 관리 탭에서 설문지를 선택하면 해당 설문지의 통계를 확인할 수 있습니다.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-semibold flex items-center gap-2">
                          <BarChart3 className="w-6 h-6" />
                          {selectedSurvey.title} - 통계
                        </CardTitle>
                        <Button variant="outline" onClick={() => setActiveTab("manage")}>
                          다른 설문지 선택
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
                          <div className="text-3xl font-bold">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id).length}
                          </div>
                          <div className="text-blue-100">총 대상자 수</div>
                        </div>
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
                          <div className="text-3xl font-bold">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed).length}
                          </div>
                          <div className="text-green-100">응답 완료</div>
                        </div>
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
                          <div className="text-3xl font-bold">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id && !p.is_completed).length}
                          </div>
                          <div className="text-purple-100">응답 미완료</div>
                        </div>
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg text-white">
                          <div className="text-3xl font-bold">
                            {participants.filter((p) => p.survey_id === selectedSurvey.id).length > 0
                              ? Math.round(
                                  (participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed)
                                    .length /
                                    participants.filter((p) => p.survey_id === selectedSurvey.id).length) *
                                    100,
                                )
                              : 0}
                            %
                          </div>
                          <div className="text-orange-100">완료율</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold">병원별 통계</CardTitle>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="병원명 검색..."
                            value={hospitalSearchFilter}
                            onChange={(e) => setHospitalSearchFilter(e.target.value)}
                            className="w-64"
                          />
                          {hospitalSearchFilter && (
                            <Button variant="outline" size="sm" onClick={() => setHospitalSearchFilter("")}>
                              초기화
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {participants.filter((p) => p.survey_id === selectedSurvey.id).length === 0 ? (
                        <Alert>
                          <AlertDescription>이 설문지에 참여자 데이터가 없습니다.</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-4">
                          {/* 전체 병원 합계 */}
                          <Card className="bg-gray-50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg font-semibold text-gray-800">전체 병원 합계</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">참여 병원 수</span>
                                <span className="font-semibold">
                                  {
                                    new Set(
                                      participants
                                        .filter((p) => p.survey_id === selectedSurvey.id)
                                        .map((p) => p.hospital_name),
                                    ).size
                                  }
                                  개
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">총 대상자</span>
                                <span className="font-semibold">
                                  {participants.filter((p) => p.survey_id === selectedSurvey.id).length}명
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">응답 완료</span>
                                <span className="font-semibold text-green-600">
                                  {
                                    participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed)
                                      .length
                                  }
                                  명
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">완료율</span>
                                <Badge variant="default">
                                  {participants.filter((p) => p.survey_id === selectedSurvey.id).length > 0
                                    ? Math.round(
                                        (participants.filter((p) => p.survey_id === selectedSurvey.id && p.is_completed)
                                          .length /
                                          participants.filter((p) => p.survey_id === selectedSurvey.id).length) *
                                          100,
                                      )
                                    : 0}
                                  %
                                </Badge>
                              </div>
                              {(() => {
                                const totalParticipants = participants.filter(
                                  (p) => p.survey_id === selectedSurvey.id,
                                ).length
                                const completedParticipants = participants.filter(
                                  (p) => p.survey_id === selectedSurvey.id && p.is_completed,
                                ).length

                                const totalScore = responses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
                                const averageScore =
                                  responses.length > 0 ? (totalScore / responses.length).toFixed(1) : "0"

                                return {
                                  total: totalParticipants,
                                  completed: completedParticipants,
                                  totalScore: totalScore,
                                  averageScore: averageScore,
                                }
                              })()}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">평균 점수</span>
                                <span className="font-semibold text-blue-600">
                                  {(() => {
                                    const totalParticipants = participants.filter(
                                      (p) => p.survey_id === selectedSurvey.id,
                                    ).length
                                    const completedParticipants = participants.filter(
                                      (p) => p.survey_id === selectedSurvey.id && p.is_completed,
                                    ).length
                                    const totalScore = responses.reduce((sum, r) => sum + (r.answer_value || 0), 0)

                                    return completedParticipants > 0
                                      ? (totalScore / completedParticipants).toFixed(1)
                                      : "-"
                                  })()}
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          {hospitalSearchFilter ? (
                            <div className="space-y-4">
                              <div className="text-sm text-gray-600">
                                검색 결과: "{hospitalSearchFilter}"에 대한{" "}
                                {
                                  Object.entries(
                                    participants
                                      .filter((p) => p.survey_id === selectedSurvey.id)
                                      .reduce((acc: Record<string, any>, participant) => {
                                        const hospital = participant.hospital_name
                                        if (!acc[hospital]) {
                                          acc[hospital] = {
                                            total: 0,
                                            completed: 0,
                                            totalScore: 0,
                                            responseCount: 0,
                                          }
                                        }
                                        acc[hospital].total += 1
                                        if (participant.is_completed) {
                                          acc[hospital].completed += 1
                                        }

                                        const participantResponses = responses.filter(
                                          (r) => r.survey_participants?.token === participant.token,
                                        )
                                        if (participantResponses.length > 0) {
                                          acc[hospital].totalScore += participantResponses.reduce(
                                            (sum, r) => sum + (r.answer_value || 0),
                                            0,
                                          )
                                          acc[hospital].responseCount += participantResponses.length
                                        }

                                        return acc
                                      }, {}),
                                  ).filter(([hospital]) =>
                                    hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
                                  ).length
                                }
                                개 병원
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(
                                  participants
                                    .filter((p) => p.survey_id === selectedSurvey.id)
                                    .reduce((acc: Record<string, any>, participant) => {
                                      const hospital = participant.hospital_name
                                      if (!acc[hospital]) {
                                        acc[hospital] = { total: 0, completed: 0, totalScore: 0, responseCount: 0 }
                                      }
                                      acc[hospital].total += 1
                                      if (participant.is_completed) {
                                        acc[hospital].completed += 1
                                      }

                                      const participantResponses = responses.filter(
                                        (r) => r.survey_participants?.token === participant.token,
                                      )
                                      if (participantResponses.length > 0) {
                                        acc[hospital].totalScore += participantResponses.reduce(
                                          (sum, r) => sum + (r.answer_value || 0),
                                          0,
                                        )
                                        acc[hospital].responseCount += participantResponses.length
                                      }

                                      return acc
                                    }, {}),
                                )
                                  .filter(([hospital]) =>
                                    hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
                                  )
                                  .map(([hospital, stats]: [string, any]) => (
                                    <Card key={hospital} className="p-4">
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-semibold">{hospital}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-3">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">총 대상자</span>
                                          <span className="font-semibold">{stats.total}명</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">응답 완료</span>
                                          <span className="font-semibold text-green-600">{stats.completed}명</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">완료율</span>
                                          <Badge
                                            variant={
                                              stats.total > 0 && stats.completed / stats.total >= 0.7
                                                ? "default"
                                                : "secondary"
                                            }
                                          >
                                            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">평균 점수</span>
                                          <span className="font-semibold text-blue-600">
                                            {stats.responseCount > 0
                                              ? (stats.totalScore / stats.responseCount).toFixed(1)
                                              : "-"}
                                          </span>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                              </div>
                              {Object.entries(
                                participants
                                  .filter((p) => p.survey_id === selectedSurvey.id)
                                  .reduce((acc: Record<string, any>, participant) => {
                                    const hospital = participant.hospital_name
                                    if (!acc[hospital]) {
                                      acc[hospital] = { total: 0, completed: 0, totalScore: 0, responseCount: 0 }
                                    }
                                    acc[hospital].total += 1
                                    if (participant.is_completed) {
                                      acc[hospital].completed += 1
                                    }

                                    const participantResponses = responses.filter(
                                      (r) => r.survey_participants?.token === participant.token,
                                    )
                                    if (participantResponses.length > 0) {
                                      acc[hospital].totalScore += participantResponses.reduce(
                                        (sum, r) => sum + (r.answer_value || 0),
                                        0,
                                      )
                                      acc[hospital].responseCount += participantResponses.length
                                    }

                                    return acc
                                  }, {}),
                              ).filter(([hospital]) =>
                                hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
                              ).length === 0 && (
                                <Alert>
                                  <AlertDescription>
                                    "{hospitalSearchFilter}"와 일치하는 병원이 없습니다.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          ) : (
                            <Alert>
                              <AlertDescription>
                                병원별 통계를 보려면 위의 검색창에서 병원명을 검색해 주세요.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">문항별 통계</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {questionStats.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            {hospitalSearchFilter
                              ? `"${hospitalSearchFilter}" 병원의 문항별 통계 데이터가 없습니다.`
                              : "문항별 통계 데이터가 없습니다."}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-4">
                          {hospitalSearchFilter && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>"{hospitalSearchFilter}"</strong> 병원의 문항별 통계를 표시하고 있습니다.
                              </p>
                            </div>
                          )}

                          {/* 문항별 상세 테이블 */}
                          <div>
                            <h4 className="text-md font-semibold mb-3">
                              문항별 상세 통계
                              {hospitalSearchFilter && (
                                <span className="text-sm font-normal text-blue-600 ml-2">
                                  ("{hospitalSearchFilter}" 병원)
                                </span>
                              )}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                  <tr className="bg-indigo-50">
                                    <th className="border border-gray-300 px-4 py-2 text-left">문항 번호</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left">문항 내용</th>
                                    <th className="border border-gray-300 px-4 py-2 text-center">응답 수</th>
                                    <th className="border border-gray-300 px-4 py-2 text-center">평균 점수</th>
                                    <th className="border border-gray-300 px-4 py-2 text-center">만족도</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {questionStats.map((stat) => (
                                    <tr key={stat.id} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-4 py-2 font-medium">
                                        문항 {stat.questionNumber}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">{stat.questionText}</td>
                                      <td className="border border-gray-300 px-4 py-2 text-center">
                                        {stat.totalResponses}명
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2 text-center">
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                                          {stat.averageScore}/{stat.maxScore}
                                        </Badge>
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2 text-center">
                                        <span
                                          className={`font-semibold ${
                                            Number.parseFloat(stat.averageScore) >= 4
                                              ? "text-green-600"
                                              : Number.parseFloat(stat.averageScore) >= 3
                                                ? "text-yellow-600"
                                                : "text-red-600"
                                          }`}
                                        >
                                          {((Number.parseFloat(stat.averageScore) / stat.maxScore) * 100).toFixed(0)}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 통계 다운로드 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">데이터 내보내기</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        <Button
                          onClick={downloadStatsExcel}
                          variant="outline"
                          className="flex items-center gap-2 bg-transparent"
                        >
                          <BarChart3 className="w-4 h-4" />
                          선택된 설문지 통계 다운로드
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-red-600">설문지 삭제 확인</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-gray-700">
                    <strong>"{surveyToDelete?.title}"</strong> 설문지를 삭제하시겠습니까?
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ 이 작업은 되돌릴 수 없으며, 모든 참여자 데이터와 응답이 함께 삭제됩니다.
                  </p>
                </div>

                <div>
                  <Label htmlFor="deletePassword" className="font-medium">
                    관리자 비밀번호 확인
                  </Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="mt-2"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setSurveyToDelete(null)
                      setDeletePassword("")
                      setError("")
                    }}
                    disabled={deleteLoading}
                  >
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteSurvey}
                    disabled={deleteLoading || !deletePassword}
                  >
                    {deleteLoading ? "삭제 중..." : "삭제"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
