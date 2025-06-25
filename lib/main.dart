import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'functions.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(MaterialApp(home: MyHomePage()));
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});
  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white, // 배경 하얗게
      body: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [

            Text("이성권 포트폴리오", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            SizedBox(height: 20),

            section("인적사항"),
            Text("이름 : 이성권"),
            Text("번호 : 010-6624-9602"),
            Text("email : gwondev0323@gmail.com"),
            Text("github : https://github.com/gwondev"),

            divider(),

            section("학력"),
            Text("• 2008/03/04 ~ 2014/02/19  연제초등학교 졸업"),
            Text("• 2008/03/03 ~ 2017/02/10  양산중학교 졸업"),
            Text("• 2017/03/02 ~ 2020/01/10  전자공업고등학교 졸업"),
            Text("• 2025/03/04 ~ 2025/02/25  조선대학교 2학년 수료"),

            divider(),

            section("프로젝트"),
            projectBox("gwon.my", "[APP] [WEB]", "FLUTTER 사용, 자기소개 및 포트폴리오 앱"),
            projectBox("devsign OJ", "[OSS] [AWS]", "오픈소스 사용, 교내 동아리 온라인 저지 시스템"),
            projectBox("MOVE : 실시간이동관리시스템", "[WEB] [IOT]", "팀빌딩6기 : GPS기술 기반 셔틀버스 경로안내 웹"),


            divider(),

            section("자격증"),
            Text("• 2017/12/27  정보처리기능사 - 한국산업인력공단"),
            Text("• 2019/06/20  정보기기운용기능사 - 한국산업인력공단"),
            Text("• 2019/03/15  컴퓨터활용능력1급 - 대한상공회의소"),
            Text("• 2025/05/24  TOPCIT 수준3 - 정보통신기획평가원"),

            divider(),

            section("경력"),
            Text("• 2025/01 ~ 2025/02  삼성전자 모바일사업부 - 운전 출장"),
            Text("• 2024/01 ~ 2024/11  독서실 총무 - 회원등록, 전산관리, 청소"),
            Text("• 2023/07 ~ 2023/09  농산업인증원 - 문서화, 사무보조"),
            Text("• 2022/08 ~ 2023/06  CU편의점 - 물류정리, 응대"),

            divider(),

            section("활동/경험"),
            Text("• 2024/09 ~ 2024/11  조선대 SOS JUMP 멘토링 프로그램 멘토"),
            Text("• 2024/07 ~ 2024/08  엠마우스복지관 컴퓨터 교사"),
            Text("• 2023/09 ~ 2023/12  조선대 올리GO 커뮤니티 활동"),

            SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
