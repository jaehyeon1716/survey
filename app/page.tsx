"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, Building2, Users, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="text-center py-16">
          <Heart className="w-24 h-24 text-blue-500 mx-auto mb-8" />
          <h1 className="text-4xl font-bold text-gray-800 mb-4">병원 만족도 조사</h1>
          <p className="text-2xl text-gray-600 mb-8">더 나은 의료 서비스를 위한 설문조사 시스템</p>

          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <p className="text-xl text-blue-800 font-medium mb-4">설문 참여 방법</p>
            <div className="space-y-3 text-lg text-blue-600">
              <div className="flex items-center justify-center space-x-2">
                <Users className="w-5 h-5" />
                <span>병원에서 발송한 개별 설문 링크를 통해 접속해 주세요</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>각 참여자별로 고유한 링크가 제공됩니다</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>9개 문항, 5점 척도로 구성된 간단한 설문입니다</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => (window.location.href = "/admin")}
              className="text-xl px-8 py-4 h-auto bg-blue-600 hover:bg-blue-700"
            >
              관리자 페이지로 이동
            </Button>
            <p className="text-lg text-gray-500">관리자이신 경우 위 버튼을 클릭하여 설문을 관리하세요.</p>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">문의사항이 있으시면 관리자에게 연락해 주세요.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
