package com.github.stars;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.github.stars.mapper")
@EnableScheduling
@EnableAsync
public class GithubStarsApplication {

    public static void main(String[] args) {
        SpringApplication.run(GithubStarsApplication.class, args);
    }
}
