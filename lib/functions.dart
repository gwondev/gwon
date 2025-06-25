import 'package:flutter/material.dart';


Widget Text1(String t){
  return Text(t);
}


Widget section(String title) {
  return Padding(
    padding: EdgeInsets.symmetric(vertical: 10),
    child: Text(
      title,
      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
    ),
  );
}

Widget divider() {
  return Padding(
    padding: EdgeInsets.symmetric(vertical: 14),
    child: Divider(thickness: 1, color: Colors.grey),
  );
}



Widget projectBox(String title, String tech, String desc) {
  return Container(
    width: double.infinity, // ← 가로 최대 너비로 설정
    margin: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
    padding: EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: Colors.grey.shade300),
      borderRadius: BorderRadius.circular(5),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        SizedBox(height: 4),
        Text(tech, style: TextStyle(fontSize: 12, color: Colors.grey[700])),
        SizedBox(height: 6),
        Text(desc, style: TextStyle(fontSize: 13)),
      ],
    ),
  );
}


